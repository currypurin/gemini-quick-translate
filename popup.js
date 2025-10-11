const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 80;
const DEFAULT_FONT_SIZE = 13;
const FONT_SIZE_STORAGE_KEY = 'bubbleFontSize';

let currentFontSize = DEFAULT_FONT_SIZE;

// DOM要素
const decreaseButton = document.getElementById('decrease-font-size');
const increaseButton = document.getElementById('increase-font-size');
const fontSizeDisplay = document.getElementById('current-font-size');

// 初期化
init();

function init() {
  loadFontSize();

  decreaseButton.addEventListener('click', () => {
    changeFontSize(-1);
  });

  increaseButton.addEventListener('click', () => {
    changeFontSize(1);
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
  decreaseButton.disabled = currentFontSize <= MIN_FONT_SIZE;
  increaseButton.disabled = currentFontSize >= MAX_FONT_SIZE;
}
