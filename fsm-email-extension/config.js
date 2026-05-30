/**
 * config.js — FSM Email Notifier
 * Handles local persistence of EmailJS config, DLs, and trigger settings.
 */

const CONFIG_KEY = 'fsm_email_notifier_config';

const defaultConfig = {
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: '',
  senderName: 'FSM System Notification',
  distributionLists: [''],
  triggers: {
    activityCreate: true,
    activityUpdate: true,
    reservationCreate: true,
    reservationUpdate: true,
  },
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : { ...defaultConfig };
  } catch {
    return { ...defaultConfig };
  }
}

function saveConfigToStorage(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function getConfigFromForm() {
  const dlInputs = document.querySelectorAll('.dl-row input');
  const dls = Array.from(dlInputs)
    .map(i => i.value.trim())
    .filter(v => v.length > 0);

  return {
    emailjsServiceId: document.getElementById('emailjsServiceId').value.trim(),
    emailjsTemplateId: document.getElementById('emailjsTemplateId').value.trim(),
    emailjsPublicKey: document.getElementById('emailjsPublicKey').value.trim(),
    senderName: document.getElementById('senderName').value.trim(),
    distributionLists: dls,
    triggers: {
      activityCreate: document.getElementById('triggerActivityCreate').checked,
      activityUpdate: document.getElementById('triggerActivityUpdate').checked,
      reservationCreate: document.getElementById('triggerReservationCreate').checked,
      reservationUpdate: document.getElementById('triggerReservationUpdate').checked,
    },
  };
}

function applyConfigToForm(cfg) {
  document.getElementById('emailjsServiceId').value = cfg.emailjsServiceId || '';
  document.getElementById('emailjsTemplateId').value = cfg.emailjsTemplateId || '';
  document.getElementById('emailjsPublicKey').value = cfg.emailjsPublicKey || '';
  document.getElementById('senderName').value = cfg.senderName || defaultConfig.senderName;
  document.getElementById('triggerActivityCreate').checked = cfg.triggers?.activityCreate ?? true;
  document.getElementById('triggerActivityUpdate').checked = cfg.triggers?.activityUpdate ?? true;
  document.getElementById('triggerReservationCreate').checked = cfg.triggers?.reservationCreate ?? true;
  document.getElementById('triggerReservationUpdate').checked = cfg.triggers?.reservationUpdate ?? true;

  // Rebuild DL rows
  const grid = document.getElementById('dlGrid');
  grid.innerHTML = '';
  const dls = (cfg.distributionLists && cfg.distributionLists.length) ? cfg.distributionLists : [''];
  dls.forEach(email => addDLRow(email));
}

function saveConfig() {
  const cfg = getConfigFromForm();
  if (!cfg.emailjsServiceId || !cfg.emailjsTemplateId || !cfg.emailjsPublicKey) {
    showToast('Please fill in all EmailJS fields.', 'error');
    return;
  }
  saveConfigToStorage(cfg);
  // Re-init EmailJS with new key
  emailjs.init(cfg.emailjsPublicKey);
  showToast('Configuration saved!', 'success');
}

// Expose globally
window.currentConfig = loadConfig;
