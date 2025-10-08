const MODEL_ID = 'gemini-flash-lite-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:streamGenerateContent`;
const decoder = new TextDecoder('utf-8');
export async function* streamGeminiTranslation({ apiKey, text, tone }) {
    var _a;
    const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const contentType = (_a = response.headers.get('Content-Type')) !== null && _a !== void 0 ? _a : '';
    console.log('Content-Type:', contentType);
    const isEventStream = contentType.toLowerCase().includes('text/event-stream');
    console.log('Is event stream:', isEventStream);
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
        console.log('Full buffer so far:', buffer);
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
                    console.log('Yielding text chunk:', text);
                    yield text;
                }
            }
            jsonEndIndex = findCompleteJsonObject(buffer);
        }
    }
    // 残りのバッファを処理
    const remaining = buffer.trim();
    console.log('Final remaining buffer:', remaining);
    if (remaining && remaining !== ']' && remaining !== '[DONE]') {
        const cleanJson = remaining.replace(/^[\[\,]\s*/, '').replace(/\]$/, '');
        if (cleanJson) {
            const text = parseAggregateFromJson(cleanJson);
            if (text) {
                fullText += text;
                console.log('Yielding final text:', text);
                yield text;
            }
        }
    }
    console.log('Total text yielded:', fullText);
}
function buildRequestPayload(text, tone) {
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
function normalizeLineEndings(input) {
    return input.replace(/\r\n/g, '\n');
}
function findCompleteJsonObject(buffer) {
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
        }
        else if (char === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}
function extractAggregateFromEvent(rawEvent) {
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
function parseAggregateFromJson(raw) {
    try {
        const payload = JSON.parse(raw);
        console.log('Gemini API payload:', payload);
        const text = extractTextFromPayload(payload);
        console.log('Extracted text:', text);
        return text || null;
    }
    catch (error) {
        console.debug('GeminiレスポンスJSONの解析に失敗しました', error);
        return null;
    }
}
function parseAggregateFromJsonArray(raw) {
    try {
        const payload = JSON.parse(raw);
        console.log('Parsing JSON array:', payload);
        // 配列の場合、各要素からテキストを抽出して結合
        if (Array.isArray(payload)) {
            let fullText = '';
            for (const item of payload) {
                const text = extractTextFromPayload(item);
                if (text) {
                    fullText += text;
                }
            }
            console.log('Extracted full text from array:', fullText);
            return fullText || null;
        }
        // 配列でない場合は通常の解析
        const text = extractTextFromPayload(payload);
        console.log('Extracted text from object:', text);
        return text || null;
    }
    catch (error) {
        console.debug('JSON配列の解析に失敗しました', error);
        return null;
    }
}
function extractTextFromPayload(payload) {
    var _a, _b, _c;
    if (!payload || typeof payload !== 'object') {
        return '';
    }
    for (const candidates of findCandidateArrays(payload)) {
        const merged = mergeParts((_b = (_a = candidates[0]) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.parts);
        if (merged) {
            return merged;
        }
    }
    const deltaContent = (_c = payload.delta) === null || _c === void 0 ? void 0 : _c.content;
    if (deltaContent === null || deltaContent === void 0 ? void 0 : deltaContent.parts) {
        const merged = mergeParts(deltaContent.parts);
        if (merged) {
            return merged;
        }
    }
    const content = payload.content;
    if (content === null || content === void 0 ? void 0 : content.parts) {
        const merged = mergeParts(content.parts);
        if (merged) {
            return merged;
        }
    }
    if (typeof payload.text === 'string') {
        return payload.text;
    }
    return '';
}
function findCandidateArrays(payload) {
    var _a, _b, _c;
    if (!payload || typeof payload !== 'object') {
        return [];
    }
    const obj = payload;
    const sources = [];
    if (Array.isArray(obj.candidates) && obj.candidates.length > 0) {
        sources.push(obj.candidates);
    }
    if (Array.isArray((_a = obj.result) === null || _a === void 0 ? void 0 : _a.candidates) && obj.result.candidates.length > 0) {
        sources.push(obj.result.candidates);
    }
    if (Array.isArray((_b = obj.response) === null || _b === void 0 ? void 0 : _b.candidates) && obj.response.candidates.length > 0) {
        sources.push(obj.response.candidates);
    }
    if (Array.isArray((_c = obj.delta) === null || _c === void 0 ? void 0 : _c.candidates) && obj.delta.candidates.length > 0) {
        sources.push(obj.delta.candidates);
    }
    return sources;
}
function mergeParts(parts) {
    if (!Array.isArray(parts)) {
        return '';
    }
    return parts
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('');
}
function computeDelta(aggregate, delivered) {
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
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch (_a) {
        return '';
    }
}
