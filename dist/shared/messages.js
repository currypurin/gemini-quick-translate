export const DEFAULT_TONE = 'polite';
export function isTranslateTextRequest(value) {
    if (!value || typeof value !== 'object')
        return false;
    const message = value;
    if (message.type !== 'translate-text')
        return false;
    const payload = message.payload;
    if (!payload || typeof payload !== 'object')
        return false;
    if (typeof payload.text !== 'string')
        return false;
    if (typeof payload.requestId !== 'string')
        return false;
    if (payload.tone && payload.tone !== 'polite' && payload.tone !== 'casual')
        return false;
    if (payload.sourceUrl && typeof payload.sourceUrl !== 'string')
        return false;
    return true;
}
