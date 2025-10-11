"use strict";
const DEFAULT_TONE = 'polite';
const BUBBLE_ID = 'gft-inline-bubble';
const MAX_SELECTION_LENGTH = 800;
const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 80;
const DEFAULT_FONT_SIZE = 13;
const FONT_SIZE_STORAGE_KEY = 'bubbleFontSize';
const MIN_WIDTH = 240;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 320;
const WIDTH_STORAGE_KEY = 'bubbleWidth';
const state = {
    requestId: null,
    selectedText: '',
    tone: DEFAULT_TONE,
    isTranslating: false,
    fontSize: DEFAULT_FONT_SIZE,
    bubbleWidth: DEFAULT_WIDTH
};
const elements = {
    bubble: null,
    preview: null,
    result: null,
    status: null,
    action: null,
    copyButton: null
};
init();
function init() {
    injectStyles();
    preloadTonePreference();
    preloadFontSize();
    preloadBubbleWidth();
    listenToStorageChanges();
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', (event) => {
        if (event.key === 'Escape') {
            hideBubble();
        }
    });
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (!state.requestId) {
            return;
        }
        if (!message || typeof message !== 'object' || !('type' in message)) {
            return;
        }
        const typed = message;
        if (typed.type === 'translation-progress') {
            if (typed.payload.requestId !== state.requestId) {
                return;
            }
            renderProgress(typed.payload.accumulated);
        }
        if (typed.type === 'translation-error') {
            if (typed.payload.requestId !== state.requestId) {
                return;
            }
            state.isTranslating = false;
            renderError(typed.payload.message);
        }
    });
}
function preloadTonePreference() {
    chrome.storage.local.get(['preferredTone'], (items) => {
        if (chrome.runtime.lastError) {
            console.debug('トーン設定の取得に失敗しました', chrome.runtime.lastError.message);
            return;
        }
        const tone = items.preferredTone;
        if (tone === 'polite' || tone === 'casual') {
            state.tone = tone;
        }
    });
}
function preloadFontSize() {
    chrome.storage.local.get([FONT_SIZE_STORAGE_KEY], (items) => {
        if (chrome.runtime.lastError) {
            console.debug('文字サイズ設定の取得に失敗しました', chrome.runtime.lastError.message);
            return;
        }
        const fontSize = items[FONT_SIZE_STORAGE_KEY];
        if (typeof fontSize === 'number' && fontSize >= MIN_FONT_SIZE && fontSize <= MAX_FONT_SIZE) {
            state.fontSize = fontSize;
            applyFontSizeToBubble();
        }
    });
}
function preloadBubbleWidth() {
    chrome.storage.local.get([WIDTH_STORAGE_KEY], (items) => {
        if (chrome.runtime.lastError) {
            console.debug('横幅設定の取得に失敗しました', chrome.runtime.lastError.message);
            return;
        }
        const bubbleWidth = items[WIDTH_STORAGE_KEY];
        if (typeof bubbleWidth === 'number' && bubbleWidth >= MIN_WIDTH && bubbleWidth <= MAX_WIDTH) {
            state.bubbleWidth = bubbleWidth;
            applyBubbleWidth();
        }
    });
}
function listenToStorageChanges() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
            return;
        }
        if (changes[FONT_SIZE_STORAGE_KEY]) {
            const newValue = changes[FONT_SIZE_STORAGE_KEY].newValue;
            if (typeof newValue === 'number' && newValue >= MIN_FONT_SIZE && newValue <= MAX_FONT_SIZE) {
                state.fontSize = newValue;
                applyFontSizeToBubble();
            }
        }
        if (changes[WIDTH_STORAGE_KEY]) {
            const newValue = changes[WIDTH_STORAGE_KEY].newValue;
            if (typeof newValue === 'number' && newValue >= MIN_WIDTH && newValue <= MAX_WIDTH) {
                state.bubbleWidth = newValue;
                applyBubbleWidth();
            }
        }
    });
}
function handleSelectionChange(event) {
    // バブル内のクリックの場合は無視
    if (event.target && elements.bubble && elements.bubble.contains(event.target)) {
        return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hideBubble();
        return;
    }
    const text = selection.toString().trim();
    if (!text || text.length > MAX_SELECTION_LENGTH || !isLikelyEnglish(text)) {
        hideBubble();
        return;
    }
    state.selectedText = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showBubble(rect, text);
}
function showBubble(rect, text) {
    ensureBubble();
    if (!elements.bubble) {
        return;
    }
    elements.bubble.style.display = 'block';
    const top = window.scrollY + rect.bottom + 12;
    const left = window.scrollX + rect.left;
    elements.bubble.style.top = `${Math.max(top, window.scrollY + 12)}px`;
    elements.bubble.style.left = `${Math.max(left, window.scrollX + 12)}px`;
    resetResult();
}
function hideBubble() {
    if (elements.bubble) {
        elements.bubble.style.display = 'none';
        elements.bubble.classList.remove('gft-expanded');
    }
    state.requestId = null;
    state.selectedText = '';
    state.isTranslating = false;
}
function ensureBubble() {
    if (elements.bubble) {
        return;
    }
    const bubble = document.createElement('div');
    bubble.id = BUBBLE_ID;
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = `
    <div class="gft-button-group">
      <button class="gft-action" type="button">翻訳</button>
      <button class="gft-copy" type="button" style="display: none;">コピー</button>
    </div>
    <div class="gft-status" role="status"></div>
    <div class="gft-result"></div>
  `;
    document.body.appendChild(bubble);
    const actionButton = bubble.querySelector('.gft-action');
    const copyButton = bubble.querySelector('.gft-copy');
    const status = bubble.querySelector('.gft-status');
    const result = bubble.querySelector('.gft-result');
    if (!actionButton || !copyButton || !status || !result) {
        return;
    }
    actionButton.addEventListener('click', () => {
        if (state.isTranslating) {
            return;
        }
        triggerTranslation();
    });
    copyButton.addEventListener('click', () => {
        copyTranslationToClipboard();
    });
    elements.bubble = bubble;
    elements.preview = null;
    elements.status = status;
    elements.result = result;
    elements.action = actionButton;
    elements.copyButton = copyButton;
    // 保存済みの文字サイズと横幅を適用
    applyFontSizeToBubble();
    applyBubbleWidth();
}
function triggerTranslation() {
    if (!state.selectedText) {
        return;
    }
    // バブルを拡張モードに切り替え
    if (elements.bubble) {
        elements.bubble.classList.add('gft-expanded');
    }
    const requestId = createRequestId();
    state.requestId = requestId;
    state.isTranslating = true;
    renderStatus('Geminiに問い合わせ中…');
    renderResult('');
    sendTranslateRequest({
        type: 'translate-text',
        payload: {
            text: state.selectedText,
            requestId,
            tone: state.tone
        }
    })
        .then((response) => {
        var _a, _b, _c;
        if (!state.requestId || state.requestId !== requestId) {
            return;
        }
        state.isTranslating = false;
        if (!(response === null || response === void 0 ? void 0 : response.ok)) {
            const errorText = (_a = response === null || response === void 0 ? void 0 : response.error) !== null && _a !== void 0 ? _a : '翻訳に失敗しました。';
            renderError(errorText);
            return;
        }
        renderStatus(`翻訳完了 (${(_b = response.elapsedMs) !== null && _b !== void 0 ? _b : 0}ms)`);
        renderResult((_c = response.translation) !== null && _c !== void 0 ? _c : '');
    })
        .catch((error) => {
        if (state.requestId !== requestId) {
            return;
        }
        state.isTranslating = false;
        const text = error instanceof Error ? error.message : String(error);
        renderError(text);
    });
}
function sendTranslateRequest(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.debug('翻訳メッセージ送信エラー', chrome.runtime.lastError.message);
                resolve({
                    ok: false,
                    requestId: message.payload.requestId,
                    error: chrome.runtime.lastError.message
                });
                return;
            }
            resolve(response !== null && response !== void 0 ? response : null);
        });
    });
}
function renderProgress(text) {
    console.log('renderProgress called with text:', text);
    renderStatus('翻訳中…');
    renderResult(text);
}
function renderStatus(text) {
    if (elements.status) {
        elements.status.textContent = text;
    }
    if (elements.action) {
        elements.action.disabled = state.isTranslating;
    }
}
function renderResult(text) {
    console.log('renderResult called with text:', text);
    if (elements.result) {
        elements.result.classList.remove('gft-error');
        elements.result.textContent = text;
        console.log('Set textContent to:', elements.result.textContent);
        if (text) {
            elements.result.style.display = 'block';
            // 翻訳結果が表示されたらコピーボタンを表示
            if (elements.copyButton) {
                elements.copyButton.style.display = 'inline-block';
            }
        }
        else {
            // テキストが空の場合はコピーボタンを非表示
            if (elements.copyButton) {
                elements.copyButton.style.display = 'none';
            }
        }
    }
}
function renderError(message) {
    if (elements.bubble) {
        elements.bubble.classList.add('gft-expanded');
    }
    renderStatus('エラーが発生しました');
    if (elements.result) {
        elements.result.textContent = message;
        elements.result.classList.add('gft-error');
        elements.result.style.display = 'block';
    }
}
function resetResult() {
    state.isTranslating = false;
    if (elements.bubble) {
        elements.bubble.classList.remove('gft-expanded');
    }
    if (elements.result) {
        elements.result.textContent = '';
        elements.result.classList.remove('gft-error');
        elements.result.style.display = 'none';
    }
    if (elements.copyButton) {
        elements.copyButton.style.display = 'none';
    }
    renderStatus('');
    if (elements.action) {
        elements.action.disabled = false;
    }
}
function applyFontSizeToBubble() {
    if (elements.result) {
        elements.result.style.fontSize = `${state.fontSize}px`;
    }
    if (elements.preview) {
        elements.preview.style.fontSize = `${state.fontSize}px`;
    }
}
function applyBubbleWidth() {
    if (elements.bubble) {
        elements.bubble.style.maxWidth = `${state.bubbleWidth}px`;
    }
}
function injectStyles() {
    if (document.getElementById('gft-inline-style')) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'gft-inline-style';
    style.textContent = `
    #${BUBBLE_ID} {
      position: absolute;
      z-index: 2147483647;
      min-width: auto;
      background: rgba(15, 23, 42, 0.96);
      color: #f8fafc;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.32);
      padding: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.6;
      display: none;
      backdrop-filter: blur(12px);
    }
    #${BUBBLE_ID}.gft-expanded {
      min-width: 240px;
      padding: 16px;
    }
    #${BUBBLE_ID} .gft-button-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    #${BUBBLE_ID} .gft-action {
      padding: 6px 16px;
      border: none;
      border-radius: 6px;
      background: linear-gradient(135deg, #2563eb, #a855f7);
      color: #fff;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    #${BUBBLE_ID} .gft-action:hover {
      opacity: 0.9;
    }
    #${BUBBLE_ID} .gft-action:disabled {
      opacity: 0.5;
      cursor: default;
    }
    #${BUBBLE_ID} .gft-copy {
      padding: 6px 16px;
      border: none;
      border-radius: 6px;
      background: rgba(248, 250, 252, 0.1);
      color: #f8fafc;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }
    #${BUBBLE_ID} .gft-copy:hover {
      background: rgba(248, 250, 252, 0.2);
    }
    #${BUBBLE_ID} .gft-copy:disabled {
      opacity: 0.5;
      cursor: default;
    }
    #${BUBBLE_ID} .gft-status {
      font-size: 11px;
      color: rgba(248, 250, 252, 0.75);
      margin-top: 8px;
      margin-bottom: 6px;
      display: none;
    }
    #${BUBBLE_ID}.gft-expanded .gft-status {
      display: block;
    }
    #${BUBBLE_ID} .gft-result {
      white-space: pre-wrap;
      word-break: break-word;
      margin-top: 8px;
      display: none;
    }
    #${BUBBLE_ID} .gft-result.gft-error {
      color: #fca5a5;
    }
  `;
    document.head.appendChild(style);
}
function truncateText(text, limit) {
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, limit)}…`;
}
function isLikelyEnglish(text) {
    return /[A-Za-z]/.test(text);
}
function createRequestId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
function copyTranslationToClipboard() {
    if (!elements.result) {
        return;
    }
    const translationText = elements.result.textContent || '';
    if (!translationText) {
        return;
    }
    navigator.clipboard.writeText(translationText)
        .then(() => {
        // コピー成功時のフィードバック
        if (elements.copyButton) {
            const originalText = elements.copyButton.textContent;
            elements.copyButton.textContent = 'コピーしました';
            elements.copyButton.disabled = true;
            setTimeout(() => {
                if (elements.copyButton) {
                    elements.copyButton.textContent = originalText;
                    elements.copyButton.disabled = false;
                }
            }, 1500);
        }
    })
        .catch((error) => {
        console.error('クリップボードへのコピーに失敗しました:', error);
        // エラー時のフィードバック
        if (elements.copyButton) {
            const originalText = elements.copyButton.textContent;
            elements.copyButton.textContent = 'コピー失敗';
            setTimeout(() => {
                if (elements.copyButton) {
                    elements.copyButton.textContent = originalText;
                }
            }, 1500);
        }
    });
}
