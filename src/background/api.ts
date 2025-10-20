import type { TranslateTone } from '../shared/messages.js';

const MODEL_ID = 'gemini-flash-lite-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:streamGenerateContent`;

interface StreamTranslationParams {
  apiKey: string;
  text: string;
  tone: TranslateTone;
}

const decoder = new TextDecoder('utf-8');

export async function* streamGeminiTranslation({ apiKey, text, tone }: StreamTranslationParams): AsyncGenerator<string> {
  // APIキーをHTTPヘッダーで送信（URLクエリパラメータより安全）
  // - ブラウザ履歴に記録されない
  // - プロキシログに残らない
  // - リファラーヘッダーで漏洩しない
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(buildRequestPayload(text, tone)),
  });

  if (!response.ok) {
    const errorBody = await safeReadText(response).catch(() => '');
    const fullError = await response.text().catch(() => errorBody);
    console.error('Gemini API Error Response:', fullError);
    throw new Error(`Gemini APIエラー: ${response.status} ${response.statusText} ${errorBody}`.trim());
  }

  if (!response.body) {
    throw new Error('Gemini APIからのストリームが利用できませんでした。');
  }

  const reader = response.body.getReader();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = normalizeLineEndings(buffer);

    // ストリーミング中に完全なJSONオブジェクトを検出して処理
    let jsonEndIndex = findCompleteJsonObject(buffer);
    while (jsonEndIndex !== -1) {
      const jsonStr = buffer.slice(0, jsonEndIndex + 1).trim();
      buffer = buffer.slice(jsonEndIndex + 1).trim();

      // 先頭の '[' や ',' を除去
      const cleanJson = jsonStr.replace(/^[\[\,]\s*/, '');

      if (cleanJson && cleanJson !== ']' && cleanJson !== '[DONE]') {
        const text = parseAggregateFromJson(cleanJson);
        if (text) {
          fullText += text;
          yield text;
        }
      }

      jsonEndIndex = findCompleteJsonObject(buffer);
    }
  }

  // 残りのバッファを処理
  const remaining = buffer.trim();

  if (remaining && remaining !== ']' && remaining !== '[DONE]') {
    const cleanJson = remaining.replace(/^[\[\,]\s*/, '').replace(/\]$/, '');
    if (cleanJson) {
      const text = parseAggregateFromJson(cleanJson);
      if (text) {
        fullText += text;
        yield text;
      }
    }
  }

}

function buildRequestPayload(text: string, tone: TranslateTone) {
  const toneInstruction = tone === 'casual'
    ? 'Use natural, casual Japanese suitable for friendly conversations.'
    : 'Use concise, polite Japanese suitable for professional documents.';

  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'Translate the following English text into natural Japanese.',
              'Requirements:',
              `- Tone: ${toneInstruction}`,
              '- Preserve technical terms and proper nouns when appropriate.',
              '- Output only the translation without additional commentary.',
              '',
              '---',
              text,
              '---'
            ].filter(Boolean).join('\n')
          }
        ]
      }
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingBudget: 0
      }
    },
    tools: [
      {
        googleSearch: {}
      }
    ]
  };
}

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n');
}

function findCompleteJsonObject(buffer: string): number {
  // JSONオブジェクトの終わりを見つける（簡易版）
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function extractAggregateFromEvent(rawEvent: string): string | null {
  const trimmed = rawEvent.trim();
  if (!trimmed) {
    return null;
  }

  const dataLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));

  if (dataLines.length === 0) {
    return parseAggregateFromJson(trimmed);
  }

  let aggregate = '';

  for (const line of dataLines) {
    const payloadRaw = line.slice(5).trim();
    if (!payloadRaw || payloadRaw === '[DONE]') {
      continue;
    }

    const parsed = parseAggregateFromJson(payloadRaw);
    if (parsed) {
      aggregate = parsed;
    }
  }

  return aggregate || null;
}

function parseAggregateFromJson(raw: string): string | null {
  try {
    const payload = JSON.parse(raw);
    const text = extractTextFromPayload(payload);
    return text || null;
  } catch (error) {
    console.debug('GeminiレスポンスJSONの解析に失敗しました', error);
    return null;
  }
}

function parseAggregateFromJsonArray(raw: string): string | null {
  try {
    const payload = JSON.parse(raw);

    // 配列の場合、各要素からテキストを抽出して結合
    if (Array.isArray(payload)) {
      let fullText = '';
      for (const item of payload) {
        const text = extractTextFromPayload(item);
        if (text) {
          fullText += text;
        }
      }
      return fullText || null;
    }

    // 配列でない場合は通常の解析
    const text = extractTextFromPayload(payload);
    return text || null;
  } catch (error) {
    console.debug('JSON配列の解析に失敗しました', error);
    return null;
  }
}

function extractTextFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  for (const candidates of findCandidateArrays(payload)) {
    const merged = mergeParts(candidates[0]?.content?.parts);
    if (merged) {
      return merged;
    }
  }

  const deltaContent = (payload as { delta?: { content?: { parts?: Array<{ text?: string }> } } }).delta?.content;
  if (deltaContent?.parts) {
    const merged = mergeParts(deltaContent.parts);
    if (merged) {
      return merged;
    }
  }

  const content = (payload as { content?: { parts?: Array<{ text?: string }> } }).content;
  if (content?.parts) {
    const merged = mergeParts(content.parts);
    if (merged) {
      return merged;
    }
  }

  if (typeof (payload as { text?: unknown }).text === 'string') {
    return (payload as { text: string }).text;
  }

  return '';
}

function findCandidateArrays(payload: unknown): Array<Array<{ content?: { parts?: Array<{ text?: string }> } }>> {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const obj = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    result?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    delta?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  };

  const sources: Array<Array<{ content?: { parts?: Array<{ text?: string }> } }>> = [];

  if (Array.isArray(obj.candidates) && obj.candidates.length > 0) {
    sources.push(obj.candidates);
  }
  if (Array.isArray(obj.result?.candidates) && obj.result.candidates.length > 0) {
    sources.push(obj.result.candidates);
  }
  if (Array.isArray(obj.response?.candidates) && obj.response.candidates.length > 0) {
    sources.push(obj.response.candidates);
  }
  if (Array.isArray(obj.delta?.candidates) && obj.delta.candidates.length > 0) {
    sources.push(obj.delta.candidates);
  }

  return sources;
}

function mergeParts(parts: Array<{ text?: string }> | undefined): string {
  if (!Array.isArray(parts)) {
    return '';
  }
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('');
}

function computeDelta(aggregate: string, delivered: string): string {
  if (!aggregate) {
    return '';
  }
  if (!delivered) {
    return aggregate;
  }
  if (aggregate.startsWith(delivered)) {
    return aggregate.slice(delivered.length);
  }
  if (delivered.startsWith(aggregate)) {
    return '';
  }
  return aggregate;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
