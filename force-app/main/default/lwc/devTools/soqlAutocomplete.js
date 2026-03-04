/**
 * ABN AMRO Developer Tools — SOQL Autocomplete Engine
 * Provides schema-aware, context-sensitive suggestions with deep relationship traversal.
 */
import { getClauseContext, SOQL_KEYWORDS, AGGREGATE_FUNCTIONS, FIELDS_FUNCTIONS } from './soqlTokenizer';

// Maximum relationship traversal depth (SOQL supports up to 5 for parent relationships)
const MAX_RELATIONSHIP_DEPTH = 4;

// Common fields that should be prioritized in scoring
const COMMON_FIELDS = ['Id', 'Name', 'CreatedDate', 'LastModifiedDate', 'OwnerId', 'CreatedById'];

// Field type icons for chip display
export const FIELD_TYPE_ICONS = {
    REFERENCE: '🔗',
    STRING: 'Aa',
    TEXTAREA: '📝',
    DATE: '📅',
    DATETIME: '🕐',
    BOOLEAN: '✓',
    CURRENCY: '💰',
    DOUBLE: '#',
    INTEGER: '#',
    PERCENT: '%',
    EMAIL: '✉',
    PHONE: '📞',
    URL: '🔗',
    PICKLIST: '☰',
    MULTIPICKLIST: '☰',
    ID: '🔑'
};

/**
 * Schema cache to avoid redundant API calls.
 */
class SchemaCache {
    constructor() {
        this.objects = null;
        this.objectsFetchedAt = null;
        this.fields = new Map(); // Map<objectApiName, {fields: [], fetchedAt}>
    }

    hasObjects() { return this.objects !== null; }
    getObjects() { return this.objects; }
    setObjects(objects) {
        this.objects = objects;
        this.objectsFetchedAt = Date.now();
    }

    hasFields(objectApiName) { return this.fields.has(objectApiName.toLowerCase()); }
    getFields(objectApiName) {
        const cached = this.fields.get(objectApiName.toLowerCase());
        return cached ? cached.fields : null;
    }
    setFields(objectApiName, fields) {
        this.fields.set(objectApiName.toLowerCase(), { fields, fetchedAt: Date.now() });
    }

    /**
     * Find a relationship field and return its target object(s).
     * @param {string} objectApiName - Source object
     * @param {string} relationshipName - Relationship name (e.g., 'Account', 'Owner', 'Custom__r')
     * @returns {string|null} - Target object API name or null
     */
    resolveRelationship(objectApiName, relationshipName) {
        const fields = this.getFields(objectApiName);
        if (!fields) return null;

        const normalizedName = relationshipName.toLowerCase();

        for (const field of fields) {
            if (field.type !== 'REFERENCE') continue;

            // Match by relationshipName (standard) or derived name (custom)
            const fieldRelName = field.relationshipName?.toLowerCase();

            if (fieldRelName === normalizedName) {
                return field.referenceTo?.[0] || null;
            }

            // Also try matching the API name with __c → __r conversion for custom
            if (field.apiName.endsWith('__c')) {
                const derivedRelName = field.apiName.replace(/__c$/i, '__r').toLowerCase();
                if (derivedRelName === normalizedName) {
                    return field.referenceTo?.[0] || null;
                }
            }
        }

        return null;
    }

    clear() {
        this.objects = null;
        this.objectsFetchedAt = null;
        this.fields.clear();
    }
}

/**
 * Calculate relevance score for a suggestion.
 */
function calculateRelevance(item, searchTerm, itemType) {
    let score = 0;
    const term = (searchTerm || '').toLowerCase();
    const apiName = (item.apiName || '').toLowerCase();
    const label = (item.label || '').toLowerCase();

    if (!term) {
        if (itemType === 'field' && COMMON_FIELDS.includes(item.apiName)) score += 30;
        if (item.isRequired) score += 20;
        if (!item.isCustom) score += 10;
        if (item.type === 'REFERENCE') score += 5;
        return score;
    }

    if (apiName === term) score += 300;
    else if (label === term) score += 280;
    if (apiName.startsWith(term)) score += 200;
    if (label.startsWith(term)) score += 150;
    if (apiName.includes(term)) score += 80;
    if (label.includes(term)) score += 60;
    if (itemType === 'field' && COMMON_FIELDS.includes(item.apiName)) score += 30;
    if (item.isNameField) score += 25;
    if (item.isRequired) score += 20;
    if (!item.isCustom) score += 10;
    if (item.type === 'REFERENCE') score += 5;

    return score;
}

/**
 * SOQL Autocomplete Engine
 */
class SoqlAutocompleteEngine {
    constructor(config = {}) {
        this.fetchObjects = config.fetchObjects || (() => Promise.resolve([]));
        this.fetchObjectDetail = config.fetchObjectDetail || (() => Promise.resolve(null));
        this.cache = new SchemaCache();
        this._pendingFetches = new Map(); // Prevent duplicate concurrent fetches
    }

    /**
     * Get autocomplete suggestions for a given query and cursor position.
     */
    async getSuggestions(query, cursorPosition) {
        const context = getClauseContext(query, cursorPosition);

        if (context.expectedNext === 'none') {
            return null;
        }

        switch (context.expectedNext) {
            case 'object':
                return this._getObjectSuggestions(context);
            case 'field':
                if (context.relationshipPath.length > 0 || context.afterDot) {
                    return this._getRelationshipFieldSuggestions(context);
                }
                return this._getFieldSuggestions(context);
            case 'keyword':
                return this._getKeywordSuggestions(context);
            default:
                return null;
        }
    }

    /**
     * Get object suggestions (for FROM clause).
     */
    async _getObjectSuggestions(context) {
        const searchTerm = context.currentWord;
        const objects = await this._fetchObjectsSafe(searchTerm);

        const scored = objects.map(obj => ({
            ...obj,
            score: calculateRelevance(obj, searchTerm, 'object')
        }));
        scored.sort((a, b) => b.score - a.score);

        const limit = searchTerm ? 20 : 50;
        const suggestions = scored.slice(0, limit).map(obj => ({
            label: obj.label || obj.apiName,
            value: obj.apiName,
            type: 'object',
            isCustom: obj.isCustom,
            icon: obj.isCustom ? '⚙️' : '📦'
        }));

        return { type: 'object', token: searchTerm, suggestions };
    }

    /**
     * Get field suggestions for the FROM object.
     */
    async _getFieldSuggestions(context) {
        const objectName = context.objectName;
        if (!objectName) {
            return this._getKeywordSuggestions(context);
        }

        if (!this.cache.hasFields(objectName)) {
            const detail = await this._fetchObjectDetailSafe(objectName);
            if (detail && detail.fields) {
                this.cache.setFields(objectName, detail.fields);
            }
        }

        const fields = this.cache.getFields(objectName) || [];
        const searchTerm = context.currentWord;

        let filtered = fields;
        if (searchTerm && searchTerm.length > 0) {
            const term = searchTerm.toLowerCase();
            filtered = fields.filter(f =>
                f.apiName.toLowerCase().includes(term) ||
                (f.label && f.label.toLowerCase().includes(term))
            );
        }

        const scored = filtered.map(f => ({
            ...f,
            score: calculateRelevance(f, searchTerm, 'field')
        }));
        scored.sort((a, b) => b.score - a.score);

        const limit = searchTerm ? 20 : 30;
        const suggestions = scored.slice(0, limit).map(f => ({
            label: f.label || f.apiName,
            value: f.apiName,
            type: 'field',
            fieldType: f.type,
            isCustom: f.isCustom,
            isRelationship: f.type === 'REFERENCE',
            relationshipName: f.relationshipName,
            referenceTo: f.referenceTo,
            icon: FIELD_TYPE_ICONS[f.type] || '·'
        }));

        // Mix in keyword suggestions for current clause
        const kwSugs = this._getContextKeywords(context);
        return {
            type: 'field',
            token: searchTerm,
            suggestions: [...suggestions, ...kwSugs],
            objectName
        };
    }

    /**
     * Get field suggestions for relationship traversal (Account.Owner.Manager.).
     */
    async _getRelationshipFieldSuggestions(context) {
        const baseName = context.objectName;
        if (!baseName) return null;

        let currentObject = baseName;
        const path = context.relationshipPath;

        if (path.length > MAX_RELATIONSHIP_DEPTH) return null;

        // Traverse each segment of the path
        for (let i = 0; i < path.length; i++) {
            const segment = path[i];

            if (!this.cache.hasFields(currentObject)) {
                const detail = await this._fetchObjectDetailSafe(currentObject);
                if (detail && detail.fields) {
                    this.cache.setFields(currentObject, detail.fields);
                }
            }

            const targetObject = this.cache.resolveRelationship(currentObject, segment);
            if (!targetObject) return null;

            currentObject = targetObject;
        }

        // Now currentObject is the object we need fields for
        if (!this.cache.hasFields(currentObject)) {
            const detail = await this._fetchObjectDetailSafe(currentObject);
            if (detail && detail.fields) {
                this.cache.setFields(currentObject, detail.fields);
            }
        }

        const fields = this.cache.getFields(currentObject) || [];
        const searchTerm = context.currentWord;

        let filtered = fields;
        if (searchTerm && searchTerm.length > 0) {
            const term = searchTerm.toLowerCase();
            filtered = fields.filter(f =>
                f.apiName.toLowerCase().includes(term) ||
                (f.label && f.label.toLowerCase().includes(term))
            );
        }

        const scored = filtered.map(f => ({
            ...f,
            score: calculateRelevance(f, searchTerm, 'field')
        }));
        scored.sort((a, b) => b.score - a.score);

        const pathDisplay = path.join('.') + (path.length > 0 ? '.' : '');
        const limit = searchTerm ? 20 : 30;
        const suggestions = scored.slice(0, limit).map(f => ({
            label: f.label || f.apiName,
            value: f.apiName,
            fullPath: pathDisplay + f.apiName,
            type: 'field',
            fieldType: f.type,
            isCustom: f.isCustom,
            isRelationship: f.type === 'REFERENCE',
            relationshipName: f.relationshipName,
            referenceTo: f.referenceTo,
            icon: FIELD_TYPE_ICONS[f.type] || '·',
            depth: path.length
        }));

        return {
            type: 'field',
            token: searchTerm,
            suggestions,
            objectName: currentObject,
            relationshipPath: path,
            isRelationshipTraversal: true
        };
    }

    /**
     * Get keyword suggestions.
     */
    _getKeywordSuggestions(context) {
        const searchTerm = context.currentWord;
        const term = (searchTerm || '').toLowerCase();

        let allKeywords = [];

        if (context.clause === 'SELECT' || !context.clause) {
            allKeywords = ['SELECT', ...AGGREGATE_FUNCTIONS, ...FIELDS_FUNCTIONS];
        } else if (context.clause === 'FROM') {
            allKeywords = ['WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT'];
        } else if (context.clause === 'WHERE') {
            allKeywords = ['AND', 'OR', 'NOT', 'IN', 'LIKE', 'ORDER BY', 'GROUP BY', 'LIMIT'];
        } else {
            allKeywords = SOQL_KEYWORDS;
        }

        let filtered = allKeywords;
        if (term) {
            filtered = allKeywords.filter(kw => kw.toLowerCase().startsWith(term));
        }

        const suggestions = filtered.slice(0, 15).map(kw => ({
            label: kw,
            value: kw,
            type: 'keyword',
            icon: '⌨️'
        }));

        return { type: 'keyword', token: searchTerm, suggestions };
    }

    _getContextKeywords(context) {
        const result = this._getKeywordSuggestions(context);
        return result && result.suggestions ? result.suggestions : [];
    }

    /**
     * Fetch objects with deduplication of concurrent requests.
     */
    async _fetchObjectsSafe(searchTerm = '') {
        const key = `__objects__${searchTerm}`;
        if (this._pendingFetches.has(key)) {
            return this._pendingFetches.get(key);
        }

        const promise = this.fetchObjects(searchTerm)
            .catch(err => {
                console.error('Failed to fetch objects:', err);
                return [];
            })
            .finally(() => {
                this._pendingFetches.delete(key);
            });

        this._pendingFetches.set(key, promise);
        return promise;
    }

    /**
     * Fetch object detail with deduplication of concurrent requests.
     */
    async _fetchObjectDetailSafe(objectApiName) {
        const key = objectApiName.toLowerCase();
        if (this._pendingFetches.has(key)) {
            return this._pendingFetches.get(key);
        }

        const promise = this.fetchObjectDetail(objectApiName)
            .catch(err => {
                console.error(`Failed to fetch detail for ${objectApiName}:`, err);
                return null;
            })
            .finally(() => {
                this._pendingFetches.delete(key);
            });

        this._pendingFetches.set(key, promise);
        return promise;
    }

    clearCache() {
        this.cache.clear();
    }
}

export default SoqlAutocompleteEngine;
