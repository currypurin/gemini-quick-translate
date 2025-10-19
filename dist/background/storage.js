import { DEFAULT_TONE } from '../shared/messages.js';
const API_KEY_STORAGE_KEY = 'geminiApiKey';
const TONE_STORAGE_KEY = 'preferredTone';
const EXTENSION_ENABLED_KEY = 'extensionEnabled';
const TRANSLATION_HISTORY_KEY = 'translationHistory';
const HISTORY_DISPLAY_COUNT_KEY = 'historyDisplayCount';
const MAX_HISTORY_ITEMS = 15;
const DEFAULT_DISPLAY_COUNT = 2;
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
export async function getExtensionEnabled() {
    const result = await chrome.storage.local.get([EXTENSION_ENABLED_KEY]);
    const value = result[EXTENSION_ENABLED_KEY];
    // デフォルトは有効
    if (typeof value === 'boolean') {
        return value;
    }
    return true;
}
export async function setExtensionEnabled(enabled) {
    await chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: enabled });
}
export async function addTranslationToHistory(item) {
    const result = await chrome.storage.local.get([TRANSLATION_HISTORY_KEY]);
    const history = Array.isArray(result[TRANSLATION_HISTORY_KEY])
        ? result[TRANSLATION_HISTORY_KEY]
        : [];
    // 新しいアイテムを先頭に追加
    history.unshift(item);
    // 最大件数を超えた場合は古いものを削除
    if (history.length > MAX_HISTORY_ITEMS) {
        history.splice(MAX_HISTORY_ITEMS);
    }
    await chrome.storage.local.set({ [TRANSLATION_HISTORY_KEY]: history });
}
export async function getTranslationHistory() {
    const result = await chrome.storage.local.get([TRANSLATION_HISTORY_KEY]);
    const history = result[TRANSLATION_HISTORY_KEY];
    if (Array.isArray(history)) {
        return history;
    }
    return [];
}
export async function getHistoryDisplayCount() {
    const result = await chrome.storage.local.get([HISTORY_DISPLAY_COUNT_KEY]);
    const count = result[HISTORY_DISPLAY_COUNT_KEY];
    if (typeof count === 'number' && count > 0) {
        return count;
    }
    return DEFAULT_DISPLAY_COUNT;
}
export async function setHistoryDisplayCount(count) {
    await chrome.storage.local.set({ [HISTORY_DISPLAY_COUNT_KEY]: count });
}
