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

let currentFontSize = DEFAULT_FONT_SIZE;
let currentWidth = DEFAULT_WIDTH;
let extensionEnabled = true;

// DOM要素
const decreaseFontButton = document.getElementById('decrease-font-size');
const increaseFontButton = document.getElementById('increase-font-size');
const fontSizeDisplay = document.getElementById('current-font-size');

const decreaseWidthButton = document.getElementById('decrease-width');
const increaseWidthButton = document.getElementById('increase-width');
const widthDisplay = document.getElementById('current-width');

const extensionToggle = document.getElementById('extension-toggle');
const toggleStatus = document.getElementById('toggle-status');

// 初期化
init();

function init() {
  loadExtensionEnabled();
  loadFontSize();
  loadWidth();

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
