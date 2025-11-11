const API_KEY_STORAGE_KEY = 'geminiApiKey';

const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 80;
const DEFAULT_FONT_SIZE = 13;
const FONT_SIZE_STORAGE_KEY = 'bubbleFontSize';

const MIN_WIDTH = 240;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 320;
const WIDTH_STORAGE_KEY = 'bubbleWidth';
const WIDTH_STEP = 10;

const EXTENSION_ENABLED_KEY = 'extensionEnabled';

const TRANSLATION_HISTORY_KEY = 'translationHistory';
const HISTORY_DISPLAY_COUNT_KEY = 'historyDisplayCount';
const MIN_DISPLAY_COUNT = 1;
const MAX_DISPLAY_COUNT = 20;
const DEFAULT_DISPLAY_COUNT = 2;

let currentFontSize = DEFAULT_FONT_SIZE;
let currentWidth = DEFAULT_WIDTH;
let extensionEnabled = true;
let historyDisplayCount = DEFAULT_DISPLAY_COUNT;
let translationHistory = [];

// DOM要素
const decreaseFontButton = document.getElementById('decrease-font-size');
const increaseFontButton = document.getElementById('increase-font-size');
const fontSizeDisplay = document.getElementById('current-font-size');

const decreaseWidthButton = document.getElementById('decrease-width');
const increaseWidthButton = document.getElementById('increase-width');
const widthDisplay = document.getElementById('current-width');

const extensionToggle = document.getElementById('extension-toggle');
const toggleStatus = document.getElementById('toggle-status');

const decreaseHistoryCountButton = document.getElementById('decrease-history-count');
const increaseHistoryCountButton = document.getElementById('increase-history-count');
const historyCountDisplay = document.getElementById('current-history-count');
const historyListElement = document.getElementById('history-list');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const apiKeyInput = document.getElementById('popup-api-key');
const apiKeySaveButton = document.getElementById('popup-api-key-save');
const apiKeyStatus = document.getElementById('popup-api-key-status');

// 初期化
init();

function init() {
  setupTabs();
  setupApiKeySection();
  loadExtensionEnabled();
  loadFontSize();
  loadWidth();
  loadHistoryDisplayCount();
  loadTranslationHistory();

  decreaseFontButton.addEventListener('click', () => {
    changeFontSize(-1);
  });

  increaseFontButton.addEventListener('click', () => {
    changeFontSize(1);
  });

  decreaseWidthButton.addEventListener('click', () => {
    changeWidth(-WIDTH_STEP);
  });

  increaseWidthButton.addEventListener('click', () => {
    changeWidth(WIDTH_STEP);
  });

  extensionToggle.addEventListener('click', toggleExtension);
  extensionToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExtension();
    }
  });

  decreaseHistoryCountButton.addEventListener('click', () => {
    changeHistoryDisplayCount(-1);
  });

  increaseHistoryCountButton.addEventListener('click', () => {
    changeHistoryDisplayCount(1);
  });

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[TRANSLATION_HISTORY_KEY]) {
      translationHistory = Array.isArray(changes[TRANSLATION_HISTORY_KEY].newValue)
        ? changes[TRANSLATION_HISTORY_KEY].newValue
        : [];
      renderHistory();
    }

    if (changes[HISTORY_DISPLAY_COUNT_KEY]) {
      const newCount = changes[HISTORY_DISPLAY_COUNT_KEY].newValue;
      if (typeof newCount === 'number' && newCount >= MIN_DISPLAY_COUNT && newCount <= MAX_DISPLAY_COUNT) {
        historyDisplayCount = newCount;
        updateHistoryCountUI();
        renderHistory();
      }
    }

    if (changes[API_KEY_STORAGE_KEY] && apiKeyStatus) {
      const newValue = changes[API_KEY_STORAGE_KEY].newValue;
      if (typeof newValue === 'string' && newValue.trim().length > 0) {
        updateApiKeyStatus('APIキーは保存済みです。');
      } else {
        updateApiKeyStatus('APIキーが未設定です。', true);
      }
    }
  });
}

function setupApiKeySection() {
  if (!apiKeyInput || !apiKeySaveButton || !apiKeyStatus) {
    return;
  }

  apiKeySaveButton.addEventListener('click', () => {
    const value = apiKeyInput.value.trim();
    if (!value) {
      updateApiKeyStatus('APIキーを入力してください。', true);
      return;
    }

    chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        updateApiKeyStatus(`保存に失敗しました: ${lastError.message}`, true);
        return;
      }
      apiKeyInput.value = '';
      updateApiKeyStatus('APIキーを保存しました。必要に応じて再入力できます。');
    });
  });

  chrome.storage.local.get([API_KEY_STORAGE_KEY], (items) => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      updateApiKeyStatus(`読み込みに失敗しました: ${lastError.message}`, true);
      return;
    }
    const stored = items[API_KEY_STORAGE_KEY];
    if (typeof stored === 'string' && stored.trim().length > 0) {
      updateApiKeyStatus('APIキーは保存済みです。');
    } else {
      updateApiKeyStatus('APIキーが未設定です。', true);
    }
  });
}

function updateApiKeyStatus(message, isError = false) {
  if (!apiKeyStatus) {
    return;
  }
  apiKeyStatus.textContent = message;
  apiKeyStatus.style.color = isError ? '#f87171' : '#c7d2fe';
}

function setupTabs() {
  if (tabButtons.length === 0 || tabPanels.length === 0) {
    return;
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-tab-target');
      if (targetId) {
        activateTab(targetId);
      }
    });
  });

  const initiallyActive = document.querySelector('.tab-button.active');
  const initialTarget = initiallyActive?.getAttribute('data-tab-target') ?? tabPanels[0].id;
  activateTab(initialTarget);
}

function activateTab(targetId) {
  tabButtons.forEach((button) => {
    const isActive = button.getAttribute('data-tab-target') === targetId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', String(!isActive));
  });
}

async function loadFontSize() {
  try {
    const result = await chrome.storage.local.get([FONT_SIZE_STORAGE_KEY]);
    const savedSize = result[FONT_SIZE_STORAGE_KEY];

    if (typeof savedSize === 'number' && savedSize >= MIN_FONT_SIZE && savedSize <= MAX_FONT_SIZE) {
      currentFontSize = savedSize;
    } else {
      currentFontSize = DEFAULT_FONT_SIZE;
    }

    updateUI();
  } catch (error) {
    console.error('文字サイズの読み込みに失敗しました:', error);
    currentFontSize = DEFAULT_FONT_SIZE;
    updateUI();
  }
}

async function changeFontSize(delta) {
  const newSize = currentFontSize + delta;

  if (newSize < MIN_FONT_SIZE || newSize > MAX_FONT_SIZE) {
    return;
  }

  currentFontSize = newSize;

  try {
    await chrome.storage.local.set({ [FONT_SIZE_STORAGE_KEY]: currentFontSize });
    updateUI();
  } catch (error) {
    console.error('文字サイズの保存に失敗しました:', error);
  }
}

function updateUI() {
  fontSizeDisplay.textContent = currentFontSize;

  // ボタンの有効/無効を切り替え
  decreaseFontButton.disabled = currentFontSize <= MIN_FONT_SIZE;
  increaseFontButton.disabled = currentFontSize >= MAX_FONT_SIZE;
}

async function loadWidth() {
  try {
    const result = await chrome.storage.local.get([WIDTH_STORAGE_KEY]);
    const savedWidth = result[WIDTH_STORAGE_KEY];

    if (typeof savedWidth === 'number' && savedWidth >= MIN_WIDTH && savedWidth <= MAX_WIDTH) {
      currentWidth = savedWidth;
    } else {
      currentWidth = DEFAULT_WIDTH;
    }

    updateWidthUI();
  } catch (error) {
    console.error('横幅の読み込みに失敗しました:', error);
    currentWidth = DEFAULT_WIDTH;
    updateWidthUI();
  }
}

async function changeWidth(delta) {
  const newWidth = currentWidth + delta;

  if (newWidth < MIN_WIDTH || newWidth > MAX_WIDTH) {
    return;
  }

  currentWidth = newWidth;

  try {
    await chrome.storage.local.set({ [WIDTH_STORAGE_KEY]: currentWidth });
    updateWidthUI();
  } catch (error) {
    console.error('横幅の保存に失敗しました:', error);
  }
}

function updateWidthUI() {
  widthDisplay.textContent = currentWidth;

  // ボタンの有効/無効を切り替え
  decreaseWidthButton.disabled = currentWidth <= MIN_WIDTH;
  increaseWidthButton.disabled = currentWidth >= MAX_WIDTH;
}

async function loadExtensionEnabled() {
  try {
    const result = await chrome.storage.local.get([EXTENSION_ENABLED_KEY]);
    const savedEnabled = result[EXTENSION_ENABLED_KEY];

    if (typeof savedEnabled === 'boolean') {
      extensionEnabled = savedEnabled;
    } else {
      extensionEnabled = true; // デフォルトは有効
    }

    updateToggleUI();
  } catch (error) {
    console.error('拡張機能有効状態の読み込みに失敗しました:', error);
    extensionEnabled = true;
    updateToggleUI();
  }
}

async function toggleExtension() {
  extensionEnabled = !extensionEnabled;

  try {
    await chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: extensionEnabled });
    updateToggleUI();
  } catch (error) {
    console.error('拡張機能有効状態の保存に失敗しました:', error);
  }
}

function updateToggleUI() {
  if (extensionEnabled) {
    extensionToggle.classList.add('active');
    extensionToggle.setAttribute('aria-checked', 'true');
    toggleStatus.textContent = '有効';
  } else {
    extensionToggle.classList.remove('active');
    extensionToggle.setAttribute('aria-checked', 'false');
    toggleStatus.textContent = '無効';
  }
}

async function loadHistoryDisplayCount() {
  try {
    const result = await chrome.storage.local.get([HISTORY_DISPLAY_COUNT_KEY]);
    const savedCount = result[HISTORY_DISPLAY_COUNT_KEY];

    if (typeof savedCount === 'number' && savedCount >= MIN_DISPLAY_COUNT && savedCount <= MAX_DISPLAY_COUNT) {
      historyDisplayCount = savedCount;
    } else {
      historyDisplayCount = DEFAULT_DISPLAY_COUNT;
    }

    updateHistoryCountUI();
  } catch (error) {
    console.error('表示件数の読み込みに失敗しました:', error);
    historyDisplayCount = DEFAULT_DISPLAY_COUNT;
    updateHistoryCountUI();
  }
}

async function changeHistoryDisplayCount(delta) {
  const newCount = historyDisplayCount + delta;

  if (newCount < MIN_DISPLAY_COUNT || newCount > MAX_DISPLAY_COUNT) {
    return;
  }

  historyDisplayCount = newCount;

  try {
    await chrome.storage.local.set({ [HISTORY_DISPLAY_COUNT_KEY]: historyDisplayCount });
    updateHistoryCountUI();
    renderHistory();
  } catch (error) {
    console.error('表示件数の保存に失敗しました:', error);
  }
}

function updateHistoryCountUI() {
  historyCountDisplay.textContent = historyDisplayCount;

  // ボタンの有効/無効を切り替え
  decreaseHistoryCountButton.disabled = historyDisplayCount <= MIN_DISPLAY_COUNT;
  increaseHistoryCountButton.disabled = historyDisplayCount >= MAX_DISPLAY_COUNT;
}

async function loadTranslationHistory() {
  try {
    const result = await chrome.storage.local.get([TRANSLATION_HISTORY_KEY]);
    translationHistory = Array.isArray(result[TRANSLATION_HISTORY_KEY])
      ? result[TRANSLATION_HISTORY_KEY]
      : [];

    renderHistory();
  } catch (error) {
    console.error('履歴の読み込みに失敗しました:', error);
    translationHistory = [];
    renderHistory();
  }
}

function renderHistory() {
  if (!historyListElement) return;

  if (translationHistory.length === 0) {
    historyListElement.innerHTML = '<div class="history-empty">履歴がありません</div>';
    return;
  }

  const displayItems = translationHistory.slice(0, historyDisplayCount);

  historyListElement.innerHTML = displayItems.map((item) => {
    const date = new Date(item.timestamp);
    const timeString = formatTime(date);
    const originalPreview = truncateText(item.originalText, 60);
    const translationPreview = truncateText(item.translation, 100);

    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-timestamp">${timeString}</span>
        </div>
        <div class="history-original">
          <div class="history-text-label">英語:</div>
          <div class="history-text">${escapeHtml(originalPreview)}</div>
        </div>
        <div class="history-translation">
          <div class="history-text-label">日本語:</div>
          <div class="history-text">${escapeHtml(translationPreview)}</div>
        </div>
        <button class="history-copy-btn" data-translation="${escapeHtml(item.translation)}">
          翻訳をコピー
        </button>
      </div>
    `;
  }).join('');

  // コピーボタンのイベントリスナーを追加
  const copyButtons = historyListElement.querySelectorAll('.history-copy-btn');
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const translation = button.getAttribute('data-translation');
      copyToClipboard(translation, button);
    });
  });
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;

  // 1分未満
  if (diff < 60000) {
    return 'たった今';
  }

  // 1時間未満
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分前`;
  }

  // 24時間未満
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}時間前`;
  }

  // それ以上
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hour}:${minute}`;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = 'コピーしました';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1500);
  } catch (error) {
    console.error('クリップボードへのコピーに失敗しました:', error);
    const originalText = button.textContent;
    button.textContent = 'コピー失敗';
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  }
}
