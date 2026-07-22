import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRequestPayload, streamGeminiTranslation } from '../dist/background/api.js';
import {
  DEFAULT_MODEL_ID,
  isGeminiModelId,
  SUPPORTED_MODEL_IDS
} from '../dist/background/storage.js';

test('Gemini 3.5 Flash-Liteを既定モデルとして扱う', () => {
  assert.equal(DEFAULT_MODEL_ID, 'gemini-3.5-flash-lite');
  assert.deepEqual(SUPPORTED_MODEL_IDS, ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']);
  assert.equal(isGeminiModelId('gemini-3.5-flash-lite'), true);
  assert.equal(isGeminiModelId('gemini-3.1-flash-lite-preview'), false);
});

test('Gemini 3.5 Flash-Liteではminimal thinking levelを送る', () => {
  const payload = buildRequestPayload('Hello', 'polite', 'gemini-3.5-flash-lite');

  assert.deepEqual(payload.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });
  assert.deepEqual(payload.tools, [{ googleSearch: {} }]);
});

test('Gemini 2.5 Flash-Liteでは従来のthinking budgetを送る', () => {
  const payload = buildRequestPayload('Hello', 'casual', 'gemini-2.5-flash-lite');

  assert.deepEqual(payload.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.match(payload.contents[0].parts[0].text, /natural, casual Japanese/);
});

test('Gemini 3.5 Flash-LiteのモデルIDと設定でストリーミングAPIを呼ぶ', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;

  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify([
      {
        candidates: [
          { content: { parts: [{ text: 'こんにちは' }] } }
        ]
      }
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const chunks = [];
    for await (const chunk of streamGeminiTranslation({
      apiKey: 'test-key',
      text: 'Hello',
      tone: 'polite',
      modelId: 'gemini-3.5-flash-lite'
    })) {
      chunks.push(chunk);
    }

    assert.equal(
      requestUrl,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?key=test-key'
    );
    assert.deepEqual(requestBody.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });
    assert.deepEqual(chunks, ['こんにちは']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
