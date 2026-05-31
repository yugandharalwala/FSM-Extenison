/**
 * fsmExtension.js — FSM Email Notifier
 *
 * Integrates with the SAP FSM Shell Client SDK.
 * Listens for Activity and Reservation CREATE / UPDATE events,
 * fetches enriched data, extracts the assigned engineer's email,
 * and fires email notifications.
 *
 * SDK Docs: https://sap.github.io/fsm-shell/
 */

/* ── Globals ── */
let shellClient = null;
let fsmContext = null;   // { account, company, cloudHost, authToken, ... }
let eventCount = 0;

const FSM_ENTITY_TYPES = {
  ACTIVITY: 'Activity',
  RESERVATION: 'Reservation',
};

/* ── SDK Initialization ── */
function initFSMShell() {
  // The FSM Shell SDK injects ShellSdk into the window when loaded
  if (!window.FSMShell.ShellSdk) {
    console.warn('[FSM Notifier] ShellSdk not available — running in standalone/demo mode.');
    setConnectionState('demo');
    startDemoMode();
    return;
  }

  try {
    shellClient = ShellSdk.init(parent, '*');

    // Request FSM context (account, auth token, etc.)
    shellClient.emit(SHELL_EVENTS.Version1.REQUIRE_CONTEXT, {
      target: {
        type: 'SHELL_CONTEXT',
      },
    });

    shellClient.on(SHELL_EVENTS.Version1.REQUIRE_CONTEXT, (context) => {
      fsmContext = context;
      console.log('[FSM Notifier] FSM context received:', context);
      setConnectionState('connected');
      showToast('Connected to SAP FSM Shell', 'success');
      registerEventListeners();
    });

    shellClient.on(SHELL_EVENTS.Version1.ERROR, (err) => {
      console.error('[FSM Notifier] Shell error:', err);
      setConnectionState('error');
    });

  } catch (err) {
    console.error('[FSM Notifier] Shell init failed:', err);
    setConnectionState('demo');
    startDemoMode();
  }
}

/* ── Event Listeners ── */
function registerEventListeners() {
  if (!shellClient) return;

  // Listen for object save events from FSM Shell
  shellClient.on(SHELL_EVENTS.Version1.OBJECT_SAVE, async (payload) => {
    await handleFSMObjectEvent(payload, 'CREATE');
  });

  shellClient.on(SHELL_EVENTS.Version1.OBJECT_UPDATE, async (payload) => {
    await handleFSMObjectEvent(payload, 'UPDATE');
  });

  // Also listen for generic navigation events that may carry entity context
  shellClient.on(SHELL_EVENTS.Version2.GET_PERMISSIONS, (payload) => {
    console.log('[FSM Notifier] Permissions payload:', payload);
  });
}

/* ── Core Event Handler ── */
async function handleFSMObjectEvent(payload, rawEventType) {
  const objectType = detectObjectType(payload);
  if (!objectType) return;

  const cfg = loadConfig();
  const eventType = rawEventType === 'CREATE' ? 'CREATE' : 'UPDATE';

  // Check if this trigger is enabled
  if (objectType === 'ACTIVITY' && eventType === 'CREATE' && !cfg.triggers?.activityCreate) return;
  if (objectType === 'ACTIVITY' && eventType === 'UPDATE' && !cfg.triggers?.activityUpdate) return;
  if (objectType === 'RESERVATION' && eventType === 'CREATE' && !cfg.triggers?.reservationCreate) return;
  if (objectType === 'RESERVATION' && eventType === 'UPDATE' && !cfg.triggers?.reservationUpdate) return;

  // Build enriched data object
  const data = extractEntityData(objectType, payload);

  // Add to live feed UI
  addEventToFeed(eventType, objectType, data);

  // Fetch FSE email from FSM API
  const fseEmail = await fetchFSEEmail(objectType, data, cfg);

  // Collect all recipients
  const recipients = [
    fseEmail,
    ...(cfg.distributionLists || []),
  ].filter(Boolean);

  // Send emails
  await sendNotificationEmails(eventType, objectType, data, recipients);
}

/* ── Object Type Detection ── */
function detectObjectType(payload) {
  if (!payload) return null;
  const type = payload?.objectType || payload?.entityType || payload?.type || '';
  const lower = type.toLowerCase();

  if (lower.includes('activity')) return 'ACTIVITY';
  if (lower.includes('reservation')) return 'RESERVATION';

  // Fallback: check payload keys
  if (payload?.subject !== undefined && payload?.responsibles !== undefined) return 'ACTIVITY';
  if (payload?.person !== undefined && payload?.startDateTime !== undefined) return 'RESERVATION';

  return null;
}

/* ── Entity Data Extraction ── */
function extractEntityData(objectType, payload) {
  const obj = payload?.object || payload?.data || payload || {};

  if (objectType === 'ACTIVITY') {
    return {
      'ID': obj.id || obj.externalId || 'N/A',
      'Subject': obj.subject || 'N/A',
      'Status': obj.status || 'N/A',
      'Priority': obj.priority || 'N/A',
      'Type': obj.type || 'N/A',
      'Planned Start': formatDate(obj.plannedStartDateTime || obj.plannedStart),
      'Planned End': formatDate(obj.plannedEndDateTime || obj.plannedEnd),
      'Customer Name': obj.customerContactName || obj.contactName || 'N/A',
      'Service Location': obj.serviceLocationAddress || obj.address || 'N/A',
      'Technician Code': obj.responsibles?.[0]?.personExternalId || obj.technicianCode || 'N/A',
      'Description': obj.description || '',
    };
  }

  if (objectType === 'RESERVATION') {
    return {
      'ID': obj.id || obj.externalId || 'N/A',
      'Person': obj.person?.name || obj.personExternalId || 'N/A',
      'Start Date/Time': formatDate(obj.startDateTime),
      'End Date/Time': formatDate(obj.endDateTime),
      'Type': obj.type || 'N/A',
      'Status': obj.status || 'N/A',
      'Remarks': obj.remarks || '',
      'External ID': obj.externalId || 'N/A',
    };
  }

  return obj;
}

/* ── Fetch FSE Email via FSM Core API ── */
async function fetchFSEEmail(objectType, data, cfg) {
  if (!fsmContext) return null;

  try {
    const { cloudHost, account, company, authToken } = fsmContext;
    const techCode = data['Technician Code'];
    if (!techCode || techCode === 'N/A') return null;

    const apiBase = `https://${cloudHost}/api/v4/${account}/${company}`;
    const query = encodeURIComponent(
      `SELECT p.email FROM Person p WHERE p.externalId = '${techCode}'`
    );

    const res = await fetch(`${apiBase}/query?query=${query}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'X-Client-ID': 'fsm-email-notifier',
        'X-Client-Version': '1.0.0',
      },
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const email = json?.data?.[0]?.email;
    if (email) {
      console.log(`[FSM Notifier] FSE email resolved: ${email}`);
      return email;
    }
  } catch (err) {
    console.warn('[FSM Notifier] Could not fetch FSE email:', err.message);
  }

  return null;
}

/* ── Demo Mode (standalone / no FSM Shell) ── */
function startDemoMode() {
  console.log('[FSM Notifier] Starting demo mode — simulating FSM events.');
  showToast('Demo mode: Simulating FSM events', 'info');

  const demoEvents = [
    {
      delay: 3000,
      type: 'CREATE',
      objectType: 'ACTIVITY',
      payload: {
        id: 'ACT-2024-001',
        subject: 'HVAC Maintenance — Building A',
        status: 'OPEN',
        priority: 'HIGH',
        type: 'PM',
        plannedStartDateTime: new Date(Date.now() + 86400000).toISOString(),
        plannedEndDateTime: new Date(Date.now() + 90000000).toISOString(),
        customerContactName: 'John Doe',
        serviceLocationAddress: '123 Main St, Frankfurt',
        responsibles: [{ personExternalId: 'EMP-FSE-042' }],
        description: 'Routine preventive maintenance for HVAC units.',
      },
    },
    {
      delay: 8000,
      type: 'UPDATE',
      objectType: 'RESERVATION',
      payload: {
        id: 'RES-2024-018',
        externalId: 'RES-EXT-018',
        personExternalId: 'EMP-FSE-042',
        startDateTime: new Date(Date.now() + 3600000).toISOString(),
        endDateTime: new Date(Date.now() + 7200000).toISOString(),
        type: 'LEAVE',
        status: 'APPROVED',
        remarks: 'Approved leave request',
      },
    },
    {
      delay: 14000,
      type: 'CREATE',
      objectType: 'RESERVATION',
      payload: {
        id: 'RES-2024-019',
        externalId: 'RES-EXT-019',
        personExternalId: 'EMP-FSE-099',
        startDateTime: new Date(Date.now() + 10800000).toISOString(),
        endDateTime: new Date(Date.now() + 18000000).toISOString(),
        type: 'TRAINING',
        status: 'PENDING',
        remarks: 'SAP FSM Training Session',
      },
    },
  ];

  demoEvents.forEach(({ delay, type, objectType, payload }) => {
    setTimeout(async () => {
      const data = extractEntityData(objectType, payload);
      addEventToFeed(type, objectType, data);

      const cfg = loadConfig();
      const recipients = cfg.distributionLists?.filter(e => e && e.includes('@')) || [];

      if (recipients.length > 0) {
        await sendNotificationEmails(type, objectType, data, recipients);
      } else {
        addEmailLog('(no DLs configured)', buildSubject(type, objectType, data['ID']), false, 'No DL emails configured');
      }
    }, delay);
  });
}

/* ── Helpers ── */
function formatDate(iso) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function setConnectionState(state) {
  const badge = document.getElementById('connectionBadge');
  const label = document.getElementById('connectionLabel');
  badge.className = 'status-badge';

  switch (state) {
    case 'connected':
      badge.classList.add('connected');
      label.textContent = 'Connected to FSM';
      break;
    case 'demo':
      badge.classList.add('connected');
      label.textContent = 'Demo Mode';
      break;
    case 'error':
      badge.classList.add('error');
      label.textContent = 'Connection Error';
      break;
    default:
      label.textContent = 'Connecting...';
  }
}

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  initFSMShell();
});
