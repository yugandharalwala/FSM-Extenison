/**
 * ui.js — FSM Email Notifier
 * DOM manipulation, event feed, email log, and toast notifications.
 */

/* ── DOMContentLoaded Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  const cfg = loadConfig();
  applyConfigToForm(cfg);

  // Init EmailJS if key present
  if (cfg.emailjsPublicKey) {
    emailjs.init(cfg.emailjsPublicKey);
  }

  // Ensure at least one DL row
  const grid = document.getElementById('dlGrid');
  if (!grid.children.length) addDLRow('');
});

/* ── DL Row Management ── */
function addDLRow(value = '') {
  const grid = document.getElementById('dlGrid');
  const row = document.createElement('div');
  row.className = 'dl-row';
  row.innerHTML = `
    <input type="email" placeholder="dl-engineers@company.com" value="${escHtml(value)}" />
    <button class="dl-remove" onclick="removeDLRow(this)" title="Remove">✕</button>
  `;
  grid.appendChild(row);
}

function removeDLRow(btn) {
  const grid = document.getElementById('dlGrid');
  if (grid.children.length > 1) {
    btn.closest('.dl-row').remove();
  } else {
    btn.closest('.dl-row').querySelector('input').value = '';
  }
}

/* ── Config Section Toggle ── */
function toggleSection(bodyId, btnId) {
  const body = document.getElementById(bodyId);
  const btn = document.getElementById(btnId);
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '▲' : '▼';
}

/* ── Event Feed ── */
function addEventToFeed(eventType, objectType, data) {
  eventCount++;
  document.getElementById('eventCounter').textContent = `${eventCount} event${eventCount !== 1 ? 's' : ''}`;

  const feed = document.getElementById('eventFeed');

  // Remove empty state
  const empty = feed.querySelector('.empty-state');
  if (empty) empty.remove();

  const now = new Date().toLocaleTimeString();
  const typeClass = eventType === 'CREATE' ? 'create' : 'update';
  const typeBadge = eventType === 'CREATE' ? 'badge-create' : 'badge-update';
  const objBadge = objectType === 'ACTIVITY' ? 'badge-activity' : 'badge-reservation';
  const title = data['Subject'] || data['Person'] || data['ID'] || 'FSM Record';
  const meta = `ID: ${data['ID']} · ${objectType}`;

  const item = document.createElement('div');
  item.className = `event-item ${typeClass}`;
  item.innerHTML = `
    <div>
      <span class="event-badge ${typeBadge}">${eventType}</span>
    </div>
    <div>
      <span class="event-badge ${objBadge}">${objectType}</span>
    </div>
    <div class="event-content">
      <div class="event-title">${escHtml(title)}</div>
      <div class="event-meta">${escHtml(meta)}</div>
    </div>
    <div class="event-time">${now}</div>
  `;

  feed.insertBefore(item, feed.firstChild);

  // Cap at 50 items
  while (feed.children.length > 50) feed.removeChild(feed.lastChild);
}

/* ── Email Log ── */
function addEmailLog(recipient, subject, success, errorMsg = '') {
  const log = document.getElementById('emailLog');

  const empty = log.querySelector('.empty-state');
  if (empty) empty.remove();

  const now = new Date().toLocaleTimeString();
  const icon = success ? '✅' : '❌';
  const toDisplay = recipient || '(unknown)';
  const subjectDisplay = subject || '(no subject)';
  const errorDisplay = !success && errorMsg ? ` — ${errorMsg}` : '';

  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <div class="log-status">${icon}</div>
    <div class="log-content">
      <div class="log-to">To: ${escHtml(toDisplay)}</div>
      <div class="log-subject">${escHtml(subjectDisplay)}${escHtml(errorDisplay)}</div>
    </div>
    <div class="log-time">${now}</div>
  `;

  log.insertBefore(item, log.firstChild);

  while (log.children.length > 100) log.removeChild(log.lastChild);
}

function clearLog() {
  const log = document.getElementById('emailLog');
  log.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <div>Log cleared</div>
      <div class="empty-sub">Emails will appear here once triggered</div>
    </div>
  `;
}

/* ── Toast Notifications ── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${escHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ── Utility ── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
