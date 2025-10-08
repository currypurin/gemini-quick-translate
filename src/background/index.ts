import { streamGeminiTranslation } from './api.js';
import { getApiKey, getPreferredTone } from './storage.js';
import type {
  BackgroundToContentMessage,
  TranslateTextRequest,
  TranslateTextResponse
} from '../shared/messages.js';
import { DEFAULT_TONE, isTranslateTextRequest } from '../shared/messages.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTranslateTextRequest(message)) {
    return false;
  }

  handleTranslateRequest(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      const text = error instanceof Error ? error.message : String(error);
      sendResponse({
        ok: false,
        requestId: message.payload.requestId,
        error: text
      } satisfies TranslateTextResponse);
    });

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gemini-flashlight-translate',
    title: 'Geminiで翻訳',
    contexts: ['selection']
  });
});

async function handleTranslateRequest(
  message: TranslateTextRequest,
  sender: chrome.runtime.MessageSender
): Promise<TranslateTextResponse> {
  const { text, requestId, tone: requestedTone } = message.payload;
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      requestId,
      error: 'APIキーが設定されていません。オプションページから登録してください。'
    };
  }

  const tone = requestedTone ?? (await getPreferredTone().catch(() => DEFAULT_TONE));
  const startedAt = Date.now();
  const tabId = typeof sender.tab?.id === 'number' ? sender.tab.id : null;

  try {
    let aggregated = '';
    for await (const chunk of streamGeminiTranslation({
      apiKey,
      text,
      tone
    })) {
      aggregated += chunk;
      if (tabId !== null && chunk) {
        notifyTab(tabId, {
          type: 'translation-progress',
          payload: {
            requestId,
            delta: chunk,
            accumulated: aggregated
          }
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    return {
      ok: true,
      requestId,
      translation: aggregated,
      elapsedMs
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (tabId !== null) {
      notifyTab(tabId, {
        type: 'translation-error',
        payload: {
          requestId,
          message: messageText
        }
      });
    }
    return {
      ok: false,
      requestId,
      error: messageText
    };
  }
}

function notifyTab(tabId: number, message: BackgroundToContentMessage) {
  chrome.tabs.sendMessage(tabId, message, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.debug('タブへの通知に失敗しました', lastError.message);
    }
  });
}
