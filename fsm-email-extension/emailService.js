/**
 * emailService.js — FSM Email Notifier
 * Handles email dispatch via EmailJS for FSM event notifications.
 * Uses EmailJS client SDK — no backend required.
 */

/**
 * Build a human-readable email subject line.
 */
function buildSubject(eventType, objectType, objectId) {
  const action = eventType === 'CREATE' ? 'Created' : 'Updated';
  const type = objectType === 'ACTIVITY' ? 'Activity' : 'Reservation';
  return `[FSM] ${type} ${action} — ID: ${objectId}`;
}

/**
 * Build a rich HTML email body for the notification.
 */
function buildEmailBody(eventType, objectType, data) {
  const action = eventType === 'CREATE' ? 'Created' : 'Updated';
  const type = objectType === 'ACTIVITY' ? 'Activity' : 'Reservation';
  const now = new Date().toLocaleString();
  const color = eventType === 'CREATE' ? '#10b981' : '#f59e0b';

  const rows = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `
      <tr>
        <td style="padding:7px 12px;font-weight:600;color:#7a8aa0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid #2a3347;">${k}</td>
        <td style="padding:7px 12px;color:#e2e8f0;font-size:13px;border-bottom:1px solid #2a3347;">${v}</td>
      </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'IBM Plex Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#161b27;border-radius:10px;border:1px solid #2a3347;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:20px 28px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:4px;">SAP Field Service Management</div>
                  <div style="font-size:20px;font-weight:600;color:#fff;">${type} ${action}</div>
                </td>
                <td align="right" style="padding-left:24px;">
                  <div style="background:rgba(0,0,0,.2);border-radius:8px;padding:8px 16px;color:#fff;font-size:12px;text-align:center;">
                    <div style="font-size:18px;margin-bottom:2px;">${eventType === 'CREATE' ? '✅' : '🔄'}</div>
                    ${action}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px 28px;">
            <p style="color:#7a8aa0;font-size:13px;margin:0 0 20px;">
              This is an automated notification from your SAP FSM system. A <strong style="color:#e2e8f0;">${type}</strong> record has been <strong style="color:${color};">${action.toLowerCase()}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e2535;border-radius:8px;border:1px solid #2a3347;overflow:hidden;margin-bottom:20px;">
              <thead>
                <tr style="background:#2a3347;">
                  <th colspan="2" style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#7a8aa0;">Record Details</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="color:#4a5568;font-size:11px;margin:0;">Sent at ${now} · FSM Email Notifier Extension</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #2a3347;background:#0f1117;">
            <p style="color:#4a5568;font-size:11px;margin:0;text-align:center;">
              This is an automated message. Please do not reply directly. Contact your FSM administrator for support.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send notification email to FSE + all DLs.
 * @param {string} eventType - 'CREATE' | 'UPDATE'
 * @param {string} objectType - 'ACTIVITY' | 'RESERVATION'
 * @param {object} data - The FSM object payload
 * @param {string[]} recipients - List of email addresses (FSE + DLs)
 */
async function sendNotificationEmails(eventType, objectType, data, recipients) {
  const cfg = loadConfig();

  if (!cfg.emailjsServiceId || !cfg.emailjsTemplateId || !cfg.emailjsPublicKey) {
    console.warn('[FSM Notifier] EmailJS not configured. Skipping email send.');
    addEmailLog(null, 'Config missing', false, 'EmailJS not configured');
    return;
  }

  const subject = buildSubject(eventType, objectType, data.id || data.externalId || 'N/A');
  const htmlBody = buildEmailBody(eventType, objectType, data);
  const senderName = cfg.senderName || 'FSM System Notification';

  const uniqueRecipients = [...new Set(recipients.filter(r => r && r.includes('@')))];

  if (uniqueRecipients.length === 0) {
    console.warn('[FSM Notifier] No valid recipients found.');
    addEmailLog('(none)', subject, false, 'No valid recipients');
    return;
  }

  // Send to each recipient individually for proper addressing
  for (const recipient of uniqueRecipients) {
    const templateParams = {
      to_email: recipient,
      to_name: recipient,
      from_name: senderName,
      subject: subject,
      message_html: htmlBody,
      message: `${objectType} ${eventType}: ${data.id || 'N/A'} — ${new Date().toLocaleString()}`,
      event_type: eventType,
      object_type: objectType,
      object_id: data.id || data.externalId || 'N/A',
    };

    try {
      await emailjs.send(cfg.emailjsServiceId, cfg.emailjsTemplateId, templateParams, cfg.emailjsPublicKey);
      addEmailLog(recipient, subject, true);
      console.log(`[FSM Notifier] Email sent to ${recipient}`);
    } catch (err) {
      addEmailLog(recipient, subject, false, err.text || err.message || 'Unknown error');
      console.error(`[FSM Notifier] Failed to send to ${recipient}:`, err);
    }
  }
}

/**
 * Send a test email to the first configured DL.
 */
async function testEmail() {
  const cfg = getConfigFromForm();
  const testRecipient = cfg.distributionLists?.[0];

  if (!testRecipient) {
    showToast('Add at least one DL email to test.', 'error');
    return;
  }
  if (!cfg.emailjsServiceId || !cfg.emailjsTemplateId || !cfg.emailjsPublicKey) {
    showToast('Fill in all EmailJS config fields first.', 'error');
    return;
  }

  saveConfigToStorage(cfg);

  showToast('Sending test email...', 'info');
  await sendNotificationEmails('CREATE', 'ACTIVITY', {
    id: 'TEST-001',
    subject: 'Test Activity',
    status: 'OPEN',
    technician: 'Test Engineer',
    plannedStart: new Date().toISOString(),
    customerName: 'Test Customer',
    location: 'Test Location',
  }, [testRecipient]);
}
