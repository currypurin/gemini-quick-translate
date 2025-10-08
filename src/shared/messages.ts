export type TranslateTone = 'polite' | 'casual';

export interface TranslateTextRequest {
  type: 'translate-text';
  payload: {
    text: string;
    requestId: string;
    tone?: TranslateTone;
    sourceUrl?: string;
  };
}

export interface TranslateTextResponse {
  ok: boolean;
  requestId: string;
  translation?: string;
  error?: string;
  elapsedMs?: number;
}

export interface TranslationProgressMessage {
  type: 'translation-progress';
  payload: {
    requestId: string;
    delta: string;
    accumulated: string;
  };
}

export interface TranslationErrorMessage {
  type: 'translation-error';
  payload: {
    requestId: string;
    message: string;
  };
}

export type BackgroundToContentMessage = TranslationProgressMessage | TranslationErrorMessage;

export const DEFAULT_TONE: TranslateTone = 'polite';

export function isTranslateTextRequest(value: unknown): value is TranslateTextRequest {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<TranslateTextRequest>;
  if (message.type !== 'translate-text') return false;
  const payload = message.payload as TranslateTextRequest['payload'] | undefined;
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.text !== 'string') return false;
  if (typeof payload.requestId !== 'string') return false;
  if (payload.tone && payload.tone !== 'polite' && payload.tone !== 'casual') return false;
  if (payload.sourceUrl && typeof payload.sourceUrl !== 'string') return false;
  return true;
}
