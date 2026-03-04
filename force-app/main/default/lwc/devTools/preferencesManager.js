/**
 * ABN AMRO Developer Tools — Preferences Manager
 * Manages user preferences in localStorage (no AI preferences).
 */
import { STORAGE_KEYS } from './devToolsConstants';

const DEFAULT_PREFERENCES = {
    theme: 'dark',
    density: 'normal',
    defaultTab: 'recordInspector',
    soqlEditorFontSize: 13,
    apexEditorFontSize: 13,
    autoCompleteEnabled: true,
    syntaxHighlighting: true,
    showFieldChips: true,
    queryHistoryEnabled: true,
    exportFormat: 'csv',
    batchSize: 200,
    showRowNumbers: true,
    confirmDestructive: true
};

let _cachedPrefs = null;

export function getPreferences() {
    if (_cachedPrefs) return { ..._cachedPrefs };
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        if (raw) {
            _cachedPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
        } else {
            _cachedPrefs = { ...DEFAULT_PREFERENCES };
        }
    } catch (e) {
        _cachedPrefs = { ...DEFAULT_PREFERENCES };
    }
    return { ..._cachedPrefs };
}

export function savePreferences(prefs) {
    try {
        const merged = { ...DEFAULT_PREFERENCES, ...prefs };
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(merged));
        _cachedPrefs = merged;
        return { ...merged };
    } catch (e) {
        return getPreferences();
    }
}

export function getPreference(key) {
    const prefs = getPreferences();
    return prefs[key] !== undefined ? prefs[key] : DEFAULT_PREFERENCES[key];
}

export function setPreference(key, value) {
    const prefs = getPreferences();
    prefs[key] = value;
    return savePreferences(prefs);
}

export function isOnboardingComplete() {
    try {
        return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
    } catch (e) {
        return false;
    }
}

export function setOnboardingComplete() {
    try {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    } catch (e) {
        // silent
    }
}

export function resetOnboarding() {
    try {
        localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    } catch (e) {
        // silent
    }
}
