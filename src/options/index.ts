const API_KEY_STORAGE_KEY = 'geminiApiKey';

document.addEventListener('DOMContentLoaded', setupOptionsPage);

function setupOptionsPage() {
  const keyInput = document.getElementById('gemini-api-key') as HTMLInputElement | null;
  const statusEl = document.getElementById('status-message');
  const saveButton = document.getElementById('save-button');

  if (!keyInput || !statusEl || !saveButton) {
    console.error('オプションページの要素が見つかりません。');
    return;
  }

  saveButton.addEventListener('click', () => {
    const value = keyInput.value.trim();
    if (!value) {
      showStatus(statusEl, 'APIキーを入力してください。', true);
      return;
    }

    chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value }, () => {
      if (chrome.runtime.lastError) {
        showStatus(statusEl, `保存に失敗しました: ${chrome.runtime.lastError.message}`, true);
        return;
      }
      keyInput.value = '';
      showStatus(statusEl, 'APIキーを保存しました。必要に応じて新しいキーを再入力してください。');
    });
  });

  chrome.storage.local.get([API_KEY_STORAGE_KEY], (items) => {
    if (chrome.runtime.lastError) {
      showStatus(statusEl, `読み込みに失敗しました: ${chrome.runtime.lastError.message}`, true);
      return;
    }
    const stored = items[API_KEY_STORAGE_KEY];
    if (typeof stored === 'string' && stored.trim().length > 0) {
      showStatus(statusEl, 'APIキーは保存済みです。更新する場合は新しいキーを入力して保存してください。');
    }
  });
}

function showStatus(element: HTMLElement, message: string, isError = false) {
  element.textContent = message;
  element.style.color = isError ? '#dc2626' : '#2563eb';
}
