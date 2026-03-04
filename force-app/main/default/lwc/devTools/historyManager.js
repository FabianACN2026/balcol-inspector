/**
 * ABN AMRO Developer Tools — History Manager
 * Manages SOQL query history in localStorage.
 */
import { STORAGE_KEYS, MAX_HISTORY_ITEMS } from './devToolsConstants';

let _cachedHistory = null;
let _cachedSaved = null;

export function getHistory() {
    if (_cachedHistory) return [..._cachedHistory];
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SOQL_HISTORY);
        _cachedHistory = raw ? JSON.parse(raw) : [];
    } catch (e) {
        _cachedHistory = [];
    }
    return [..._cachedHistory];
}

export function saveToHistory(entry) {
    try {
        const history = getHistory();
        const newEntry = {
            query: entry.query,
            rowCount: entry.rowCount || 0,
            executionTime: entry.executionTime || 0,
            id: Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
            timestamp: new Date().toISOString()
        };
        history.unshift(newEntry);
        if (history.length > MAX_HISTORY_ITEMS) {
            history.length = MAX_HISTORY_ITEMS;
        }
        localStorage.setItem(STORAGE_KEYS.SOQL_HISTORY, JSON.stringify(history));
        _cachedHistory = history;
        return [...history];
    } catch (e) {
        return getHistory();
    }
}

export function clearHistory() {
    try {
        localStorage.removeItem(STORAGE_KEYS.SOQL_HISTORY);
    } catch (e) {
        // silent
    }
    _cachedHistory = [];
    return [];
}

export function getRelativeTime(isoString) {
    if (!isoString) return '';
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoString).toLocaleDateString();
}

export function getSavedQueries() {
    if (_cachedSaved) return [..._cachedSaved];
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SAVED_QUERIES);
        _cachedSaved = raw ? JSON.parse(raw) : [];
    } catch (e) {
        _cachedSaved = [];
    }
    return [..._cachedSaved];
}

export function saveQuery(name, query) {
    try {
        const saved = getSavedQueries();
        const entry = {
            id: Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
            name,
            query,
            timestamp: new Date().toISOString()
        };
        saved.unshift(entry);
        localStorage.setItem(STORAGE_KEYS.SAVED_QUERIES, JSON.stringify(saved));
        _cachedSaved = saved;
        return [...saved];
    } catch (e) {
        return getSavedQueries();
    }
}

export function deleteSavedQuery(queryId) {
    try {
        let saved = getSavedQueries();
        saved = saved.filter(q => q.id !== queryId);
        localStorage.setItem(STORAGE_KEYS.SAVED_QUERIES, JSON.stringify(saved));
        _cachedSaved = saved;
        return [...saved];
    } catch (e) {
        return getSavedQueries();
    }
}
