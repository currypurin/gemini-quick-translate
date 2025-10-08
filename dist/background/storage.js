import { DEFAULT_TONE } from '../shared/messages.js';
const API_KEY_STORAGE_KEY = 'geminiApiKey';
const TONE_STORAGE_KEY = 'preferredTone';
export async function getApiKey() {
    const result = await chrome.storage.local.get([API_KEY_STORAGE_KEY]);
    const value = result[API_KEY_STORAGE_KEY];
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return null;
}
export async function getPreferredTone() {
    const result = await chrome.storage.local.get([TONE_STORAGE_KEY]);
    const value = result[TONE_STORAGE_KEY];
    if (value === 'casual' || value === 'polite') {
        return value;
    }
    return DEFAULT_TONE;
}
export async function setPreferredTone(tone) {
    await chrome.storage.local.set({ [TONE_STORAGE_KEY]: tone });
}
