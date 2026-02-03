// Initialize localization
function initLocalization() {
  document.querySelectorAll('[id]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.id);
    if (msg) {
      if (el.tagName === 'INPUT' && el.type === 'button') {
        el.value = msg;
      } else {
        el.textContent = msg;
      }
    }
  });
}

// Saves options to chrome.storage
const saveOptions = () => {
  const theme = document.getElementById('theme').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const showPath = document.getElementById('showPath').checked;
  const showRecent = document.getElementById('showRecent').checked;

  chrome.storage.sync.set(
    { theme, threshold, showPath, showRecent },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = chrome.i18n.getMessage('savedMessage');
      setTimeout(() => {
        status.textContent = '';
      }, 1500);
    }
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    { theme: 'auto', threshold: 0.4, showPath: true, showRecent: true },
    (items) => {
      document.getElementById('theme').value = items.theme;
      document.getElementById('threshold').value = items.threshold;
      document.getElementById('threshold-value').textContent = items.threshold;
      document.getElementById('showPath').checked = items.showPath;
      document.getElementById('showRecent').checked = items.showRecent;
    }
  );
};

document.addEventListener('DOMContentLoaded', () => {
  initLocalization();
  restoreOptions();
});

document.getElementById('save').addEventListener('click', saveOptions);

document.getElementById('threshold').addEventListener('input', (e) => {
  document.getElementById('threshold-value').textContent = e.target.value;
});
