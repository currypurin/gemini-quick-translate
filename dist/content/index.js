"use strict";
const DEFAULT_TONE = 'polite';
const BUBBLE_ID = 'gft-inline-bubble';
const MAX_SELECTION_LENGTH = 800;
const state = {
    requestId: null,
    selectedText: '',
    tone: DEFAULT_TONE,
    isTranslating: false
};
const elements = {
    bubble: null,
    preview: null,
    result: null,
    status: null,
    action: null
};
init();
function init() {
    injectStyles();
    preloadTonePreference();
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
function handleSelectionChange() {
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
    if (!elements.bubble || !elements.preview) {
        return;
    }
    elements.preview.textContent = truncateText(text, 160);
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
    <div class="gft-header">
      <span class="gft-title">Gemini 翻訳</span>
      <button class="gft-close" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="gft-preview" aria-label="選択テキストプレビュー"></div>
    <button class="gft-action" type="button">翻訳</button>
    <div class="gft-status" role="status"></div>
    <div class="gft-result"></div>
  `;
    document.body.appendChild(bubble);
    const closeButton = bubble.querySelector('.gft-close');
    const actionButton = bubble.querySelector('.gft-action');
    const preview = bubble.querySelector('.gft-preview');
    const status = bubble.querySelector('.gft-status');
    const result = bubble.querySelector('.gft-result');
    if (!closeButton || !actionButton || !preview || !status || !result) {
        return;
    }
    closeButton.addEventListener('click', hideBubble);
    actionButton.addEventListener('click', () => {
        if (state.isTranslating) {
            return;
        }
        triggerTranslation();
    });
    elements.bubble = bubble;
    elements.preview = preview;
    elements.status = status;
    elements.result = result;
    elements.action = actionButton;
}
function triggerTranslation() {
    if (!state.selectedText) {
        return;
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
        }
    }
}
function renderError(message) {
    renderStatus('エラーが発生しました');
    if (elements.result) {
        elements.result.textContent = message;
        elements.result.classList.add('gft-error');
    }
}
function resetResult() {
    state.isTranslating = false;
    if (elements.result) {
        elements.result.textContent = '';
        elements.result.classList.remove('gft-error');
    }
    renderStatus('翻訳を開始するにはボタンをクリック');
    if (elements.action) {
        elements.action.disabled = false;
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
      min-width: 240px;
      max-width: 320px;
      background: rgba(15, 23, 42, 0.96);
      color: #f8fafc;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.32);
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.6;
      display: none;
      backdrop-filter: blur(12px);
    }
    #${BUBBLE_ID} .gft-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      gap: 8px;
    }
    #${BUBBLE_ID} .gft-title {
      font-weight: 600;
      font-size: 13px;
    }
    #${BUBBLE_ID} .gft-close {
      background: transparent;
      border: none;
      color: inherit;
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
    }
    #${BUBBLE_ID} .gft-preview {
      background: rgba(255, 255, 255, 0.05);
      padding: 8px;
      border-radius: 8px;
      margin-bottom: 8px;
      max-height: 80px;
      overflow: hidden;
    }
    #${BUBBLE_ID} .gft-action {
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #2563eb, #a855f7);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 8px;
    }
    #${BUBBLE_ID} .gft-action:disabled {
      opacity: 0.5;
      cursor: default;
    }
    #${BUBBLE_ID} .gft-status {
      font-size: 11px;
      color: rgba(248, 250, 252, 0.75);
      margin-bottom: 6px;
    }
    #${BUBBLE_ID} .gft-result {
      font-size: 13px;
      white-space: pre-wrap;
      min-height: 20px;
      word-break: break-word;
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
