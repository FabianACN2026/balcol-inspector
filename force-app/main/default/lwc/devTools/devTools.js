/**
 * ABN AMRO Developer Tools — Main LWC Controller
 * Orchestrates 4 tools: Record Inspector, SOQL Explorer, Apex Runner, Data Loader.
 */
import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { updateRecord as ldsUpdateRecord } from 'lightning/uiRecordApi';

/* ─── Apex Imports ─── */
import hasAccess from '@salesforce/apex/DevToolsAccessController.hasAccess';
import executeQueryCursor from '@salesforce/apex/SOQLExplorerController.executeQueryCursor';
import executeSOSL from '@salesforce/apex/SOQLExplorerController.executeSOSL';
import getAccessibleObjects from '@salesforce/apex/MetadataBrowserController.getAccessibleObjects';
import getObjectDetail from '@salesforce/apex/MetadataBrowserController.getObjectDetail';
import getFields from '@salesforce/apex/SOQLExplorerController.getFields';
import getQueryPlan from '@salesforce/apex/SOQLExplorerController.getQueryPlan';
import createExportFile from '@salesforce/apex/SOQLExplorerController.createExportFile';
import getRecordData from '@salesforce/apex/RecordInspectorController.getRecordData';
import deleteRecord from '@salesforce/apex/RecordInspectorController.deleteRecord';
import bulkDeleteRecords from '@salesforce/apex/RecordInspectorController.bulkDeleteRecords';
import cascadeDeleteRecord from '@salesforce/apex/RecordInspectorController.cascadeDeleteRecord';
import getChildRelationships from '@salesforce/apex/RecordInspectorController.getChildRelationships';
import getRecordHistory from '@salesforce/apex/RecordInspectorController.getRecordHistory';
import updateRecordFields from '@salesforce/apex/RecordInspectorController.updateRecordFields';
import ensureTraceFlag from '@salesforce/apex/ApexRunnerController.ensureTraceFlag';
import executeAnonymousApex from '@salesforce/apex/ApexRunnerController.executeAnonymousApex';
import getRecentLogs from '@salesforce/apex/ApexRunnerController.getRecentLogs';
import getLogBody from '@salesforce/apex/ApexRunnerController.getLogBody';
import getExecutionLog from '@salesforce/apex/ApexRunnerController.getExecutionLog';
import insertRecords from '@salesforce/apex/DataLoaderController.insertRecords';
import updateRecords from '@salesforce/apex/DataLoaderController.updateRecords';
import upsertRecords from '@salesforce/apex/DataLoaderController.upsertRecords';

/* ─── Helper Imports ─── */
import SoqlAutocompleteEngine from './soqlAutocomplete';
import { highlightSOQL } from './soqlHighlighter';
import { getQueryContext } from './soqlTokenizer';
import { buildCSVContent } from './csvExporter';
import { parseCSV, autoMapFields } from './csvParser';
import { getHistory, saveToHistory, clearHistory, getRelativeTime, getSavedQueries, saveQuery, deleteSavedQuery } from './historyManager';
import { getPreferences, setPreference, isOnboardingComplete, setOnboardingComplete, resetOnboarding } from './preferencesManager';
import { MODULES, MODULE_LIST, FIELD_TYPE_ICONS, APEX_SNIPPETS, ONBOARDING_STEPS, MAX_QUERY_TABS, MAX_RI_TABS, DATA_LOADER_OPERATIONS } from './devToolsConstants';

/* ─── Constants ─── */
const DEBOUNCE_MS = 50;
const MAX_VISIBLE_CHIPS = 10;
const ROW_ACTIONS = [
    { label: 'Inspect', name: 'inspect' },
    { label: 'Delete', name: 'delete' }
];
const EDITABLE_COLUMN_TYPES = new Set([
    'STRING', 'TEXTAREA', 'INTEGER', 'DOUBLE', 'CURRENCY', 'PERCENT',
    'DATE', 'DATETIME', 'BOOLEAN', 'EMAIL', 'PHONE', 'URL', 'PICKLIST'
]);
const SF_TO_DT_TYPE = {
    'BOOLEAN': 'boolean', 'CURRENCY': 'currency', 'DATE': 'date',
    'DATETIME': 'date', 'DOUBLE': 'number', 'INTEGER': 'number',
    'LONG': 'number', 'PERCENT': 'percent', 'EMAIL': 'email',
    'PHONE': 'phone', 'URL': 'url'
};

export default class DevTools extends LightningElement {

    /* ═══════════════════════════════════════════════
       STATE — ACCESS & SHELL
       ═══════════════════════════════════════════════ */

    _isLoading = true;
    _hasAccess = false;
    _activeTab = 'recordInspector';
    _theme = 'dark';
    _toast = null;
    _showPreferences = false;
    _showOnboarding = false;
    _onboardingIndex = 0;
    _showDeleteConfirm = false;
    _deleteConfirmMessage = '';
    _pendingDeleteAction = null;

    /* ═══════════════════════════════════════════════
       STATE — SOQL EXPLORER
       ═══════════════════════════════════════════════ */

    __queryTabs = [];
    _activeQueryTabId = '';
    _detectedObjectName = null;
    _objectFields = [];
    _selectedFieldChips = [];
    _fieldChipFilter = '';
    _fieldChipsLoading = false;
    _showAutocomplete = false;
    _autocompleteSuggestions = [];
    _activeAutocompleteIndex = -1;
    _autocompleteRequestId = 0;
    _autocompleteSuggestionsTotal = 0;
    _debounceTimer = null;
    _scrollRafPending = false;
    _showHistory = false;
    _showSaveDialog = false;
    _saveQueryName = '';
    _queryHistory = [];
    _savedQueries = [];
    _showQueryPlan = false;
    _queryPlanLoading = false;
    _queryPlanJson = '';
    _draftValues = [];
    _selectedRows = [];
    _showChart = false;
    _autocompleteEngine = null;
    _objectSearchTerm = '';
    _objectChipsLoading = false;
    _soqlEditorFocused = false;
    _cachedRecentObjects = null;
    _cachedRecentObjectsKey = '';

    /* ═══════════════════════════════════════════════
       STATE — RECORD INSPECTOR (tab-based)
       ═══════════════════════════════════════════════ */

    __riTabs = [];
    _activeRiTabId = '';

    /* ═══════════════════════════════════════════════
       STATE — APEX RUNNER
       ═══════════════════════════════════════════════ */

    _apexCode = '';
    _apexExecuting = false;
    _apexDmlConfirmed = false;
    _apexResult = null;
    _showApexLogs = false;
    _apexLogs = [];
    _apexLogsLoading = false;
    _showLogDetail = false;
    _logDetailBody = '';
    _traceFlagChecked = false;

    /* ═══════════════════════════════════════════════
       STATE — DATA LOADER
       ═══════════════════════════════════════════════ */

    _dlStep = 1;
    _dlOperation = 'insert';
    _dlSelectedObject = '';
    _dlObjectSearch = '';
    _dlObjectResults = [];
    _dlExternalIdField = '';
    _dlParsedData = null;
    _dlMappings = [];
    _dlTargetFields = [];
    _dlBatchSize = 200;
    _dlIsExecuting = false;
    _dlCurrentBatch = 0;
    _dlBatchCount = 0;
    _dlResults = [];
    _dlResultSuccess = 0;
    _dlResultFailures = 0;
    _dlResultTotal = 0;
    _allObjects = null;


    /* ═══════════════════════════════════════════════
       LIFECYCLE
       ═══════════════════════════════════════════════ */

    connectedCallback() {
        this._initPreferences();
        this._initQueryTabs();
        this._initRiTabs();
        this._initHistory();
        this._initAutocomplete();
        // Objects and field chips are fetched lazily when SOQL tab activates
    }

    renderedCallback() {
        this._syncEditorHighlight();
    }

    disconnectedCallback() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
        }
    }

    /* ─── @wire: Access Check ─── */
    @wire(hasAccess)
    wiredAccess({ data, error }) {
        if (data !== undefined) {
            this._hasAccess = data === true;
            this._isLoading = false;
            if (this._hasAccess && !isOnboardingComplete()) {
                this._showOnboarding = true;
            }
            if (this._hasAccess) {
                // Lazy-init SOQL tab if it's the default
                this._ensureSoqlReady(this._activeTab);
                // Auto-load record if CurrentPageReference fired first
                if (this._pendingAutoRecordId) {
                    const autoId = this._pendingAutoRecordId;
                    this._pendingAutoRecordId = null;
                    this._inspectRecordById(autoId);
                }
            }
        } else if (error) {
            this._isLoading = false;
            this._hasAccess = false;
        }
    }

    /* ─── @wire: Page Reference (auto-load record) ─── */
    _pendingAutoRecordId = null;

    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (!pageRef) return;
        const recId = pageRef.attributes && pageRef.attributes.recordId;
        if (recId) {
            if (this._hasAccess) {
                this._inspectRecordById(recId);
            } else {
                // hasAccess wire hasn't resolved yet — stash for later
                this._pendingAutoRecordId = recId;
            }
        }
    }


    /* ═══════════════════════════════════════════════
       INITIALIZATION
       ═══════════════════════════════════════════════ */

    _initPreferences() {
        const prefs = getPreferences();
        this._theme = prefs.theme || 'dark';
        this._activeTab = prefs.defaultTab || 'recordInspector';
        this._showRowNumbers = prefs.showRowNumbers !== false;
        this._applyTheme();
    }

    _applyTheme() {
        if (this._theme === 'dark') {
            this.template.host.setAttribute('data-theme', 'dark');
        } else {
            this.template.host.removeAttribute('data-theme');
        }
    }

    _initQueryTabs() {
        this._activeQueryTabId = 'tab-1';
        this._queryTabs = [{
            id: 'tab-1',
            label: 'Query 1',
            query: '',
            results: null,
            columns: [],
            totalSize: 0,
            executionTime: 0,
            error: null,
            isExecuting: false,
            objectName: null
        }];
    }

    _initRiTabs() {
        this._activeRiTabId = 'ri-tab-1';
        this.__riTabs = [this._createRiTab('ri-tab-1', 'New Tab')];
    }

    _createRiTab(id, label) {
        return {
            id,
            label,
            recordId: '',
            record: null,
            isLoading: false,
            saving: false,
            view: 'fields',
            fieldSearch: '',
            fieldFilter: 'all',
            populatedOnly: false,
            editMode: false,
            draftValues: {},
            relatedLists: [],
            relatedLoading: false,
            history: [],
            historyLoading: false
        };
    }

    _initHistory() {
        this._queryHistory = getHistory().map(h => ({
            ...h,
            relativeTime: getRelativeTime(h.timestamp)
        }));
        this._savedQueries = getSavedQueries();
    }

    _initAutocomplete() {
        this._autocompleteEngine = new SoqlAutocompleteEngine({
            fetchObjects: async (searchTerm) => {
                try {
                    // Server-side filtering via MetadataBrowserController (EntityDefinition)
                    const result = await getAccessibleObjects({ searchTerm: searchTerm || '' });
                    // Cache the full list when no search term for object chips
                    if (!searchTerm) {
                        this._allObjects = result;
                    }
                    return result;
                } catch (e) {
                    return this._allObjects || [];
                }
            },
            fetchObjectDetail: async (objectApiName) => {
                try {
                    return await getObjectDetail({ objectApiName });
                } catch (e) {
                    return null;
                }
            }
        });
    }

    async _prefetchObjects() {
        this._objectChipsLoading = true;
        try {
            this._allObjects = await getAccessibleObjects({ searchTerm: '' });
        } catch (e) {
            this._allObjects = [];
        } finally {
            this._objectChipsLoading = false;
        }
    }

    _getRecentObjectNames() {
        // Memoize: only recompute when history changes
        const history = getHistory();
        const key = history.map(h => h.id || '').join(',');
        if (this._cachedRecentObjectsKey === key && this._cachedRecentObjects) {
            return this._cachedRecentObjects;
        }
        const names = [];
        const seen = new Set();
        for (const h of history) {
            const match = (h.query || '').match(/FROM\s+(\w+)/i);
            if (match && !seen.has(match[1])) {
                seen.add(match[1]);
                names.push(match[1]);
            }
        }
        this._cachedRecentObjects = names.slice(0, 6);
        this._cachedRecentObjectsKey = key;
        return this._cachedRecentObjects;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — SHELL
       ═══════════════════════════════════════════════ */

    get _showAccessDenied() {
        return !this._isLoading && !this._hasAccess;
    }

    get containerClass() {
        return 'abn-container';
    }

    get _isDarkTheme() {
        return this._theme === 'dark';
    }

    get _themeIcon() {
        return this._isDarkTheme ? 'utility:daylight' : 'utility:night';
    }

    _cachedModuleList = null;
    _cachedModuleListTab = null;
    get _moduleList() {
        // Memoize: only recompute when active tab changes
        if (this._cachedModuleListTab === this._activeTab && this._cachedModuleList) {
            return this._cachedModuleList;
        }
        this._cachedModuleListTab = this._activeTab;
        this._cachedModuleList = MODULE_LIST.map(m => ({
            ...m,
            tabClass: `abn-tab${this._activeTab === m.id ? ' abn-tab--active' : ''}`,
            isActive: this._activeTab === m.id ? 'true' : 'false',
            panelId: `panel-${m.id}`
        }));
        return this._cachedModuleList;
    }

    get _apexSnippets() { return APEX_SNIPPETS; }

    /* ─── Panel visibility ─── */
    get riPanelClass() { return `abn-panel${this._activeTab === 'recordInspector' ? ' abn-panel--active' : ''}`; }
    get soqlPanelClass() { return `abn-panel${this._activeTab === 'soqlExplorer' ? ' abn-panel--active' : ''}`; }
    get apexPanelClass() { return `abn-panel${this._activeTab === 'apexRunner' ? ' abn-panel--active' : ''}`; }
    get dlPanelClass() { return `abn-panel${this._activeTab === 'dataLoader' ? ' abn-panel--active' : ''}`; }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — TOAST
       ═══════════════════════════════════════════════ */

    get toastClass() {
        const variant = this._toast ? this._toast.variant : 'info';
        return `abn-toast abn-toast--${variant}`;
    }

    get toastDotClass() {
        const variant = this._toast ? this._toast.variant : 'info';
        return `abn-status-dot abn-status-dot--${variant}`;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — SOQL EXPLORER
       ═══════════════════════════════════════════════ */

    get _currentTab() {
        const tabs = this.__queryTabs || [];
        return tabs.find(t => t.id === this._activeQueryTabId) || tabs[0];
    }

    get _currentQuery() {
        return this._currentTab ? this._currentTab.query : '';
    }

    get _isQueryExecuting() {
        return this._currentTab && this._currentTab.isExecuting;
    }

    get _currentTabHasResults() {
        return this._currentTab && this._currentTab.results && this._currentTab.results.length > 0;
    }

    get _currentTabResults() {
        return this._currentTab ? this._currentTab.results : [];
    }

    get _currentTabColumns() {
        if (this._activeTab !== 'soqlExplorer') return [];
        const tab = this._currentTab;
        if (!tab || !tab.columns) return [];
        // Cache: only recompute when columns array reference changes
        if (this.__cachedColsSrc === tab.columns) return this.__cachedCols;
        const cols = tab.columns.map(c => ({
            label: c.label || c.fieldName,
            fieldName: c.fieldName,
            type: this._mapColumnType(c.type),
            editable: c.fieldName !== 'Id' && !c.fieldName.includes('.') && EDITABLE_COLUMN_TYPES.has((c.type || '').toUpperCase()),
            sortable: true
        }));
        cols.push({ type: 'action', typeAttributes: { rowActions: ROW_ACTIONS } });
        this.__cachedColsSrc = tab.columns;
        this.__cachedCols = cols;
        return cols;
    }

    get _currentTabResultCount() {
        return this._currentTab ? this._currentTab.totalSize : 0;
    }

    get _currentTabExecTime() {
        return this._currentTab ? this._currentTab.executionTime : 0;
    }

    get _currentTabError() {
        return this._currentTab ? this._currentTab.error : null;
    }

    get _noResults() {
        return !this._currentTabHasResults;
    }

    get _hasSelectedRows() {
        return this._selectedRows.length > 0;
    }

    get _selectedRowCount() {
        return this._selectedRows.length;
    }

    get _hasDraftValues() {
        return this._draftValues.length > 0;
    }

    get _hideCheckboxColumn() {
        return false;
    }

    get _showRowNumbers() {
        return this.__showRowNumbers !== false;
    }

    set _showRowNumbers(val) {
        this.__showRowNumbers = val;
    }

    get _canAddTab() {
        return this._queryTabs.length < MAX_QUERY_TABS;
    }

    get _hasSavedQueries() {
        return this._savedQueries.length > 0;
    }

    get _hasQueryHistory() {
        return this._queryHistory.length > 0;
    }

    get _saveQueryNameEmpty() {
        return !this._saveQueryName.trim();
    }

    get _activeAutocompleteId() {
        if (this._activeAutocompleteIndex >= 0 && this._autocompleteSuggestions[this._activeAutocompleteIndex]) {
            return this._autocompleteSuggestions[this._activeAutocompleteIndex].id;
        }
        return '';
    }

    get _autocompleteTypeLabel() {
        if (!this._autocompleteSuggestions.length) return '';
        const type = this._autocompleteSuggestions[0].type;
        if (type === 'field') return 'Fields';
        if (type === 'object') return 'Objects';
        if (type === 'keyword') return 'Keywords';
        return type || '';
    }

    get _suggestionsMoreCount() {
        const total = this._autocompleteSuggestionsTotal || 0;
        const shown = this._autocompleteSuggestions.length;
        return total > shown ? total - shown : 0;
    }

    get _showObjectChips() {
        if (this._activeTab !== 'soqlExplorer') return false;
        // Show when user is searching objects OR when editor has no object detected yet (needs FROM)
        return !!(this._objectSearchTerm) || (this._soqlEditorFocused && !this._detectedObjectName);
    }

    get _objectChips() {
        // Skip expensive computation when SOQL tab is not active
        if (this._activeTab !== 'soqlExplorer') return [];
        const allObjs = this._allObjects || [];
        const detected = this._detectedObjectName;
        if (this._objectSearchTerm && this._objectSearchTerm.length >= 1) {
            const search = this._objectSearchTerm.toLowerCase();
            return allObjs
                .filter(o =>
                    ((o.apiName || '').toLowerCase().includes(search) ||
                    (o.label || '').toLowerCase().includes(search)) &&
                    o.apiName !== detected
                )
                .slice(0, 10)
                .map(o => ({
                    apiName: o.apiName,
                    label: o.label,
                    displayName: o.apiName,
                    chipTitle: `${o.label} (${o.apiName})`,
                    chipClass: 'abn-object-chip',
                    isCustom: o.isCustom === true || o.isCustom === 'true'
                }));
        }
        // Show recent objects from history + common defaults
        const recentObjects = this._getRecentObjectNames();
        const defaults = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task'];
        const combined = [...new Set([...recentObjects, ...defaults])]
            .filter(name => name !== detected)
            .slice(0, 10);
        const allObjsMap = {};
        (this._allObjects || []).forEach(o => { allObjsMap[o.apiName] = o; });
        return combined.map(name => {
            const obj = allObjsMap[name];
            return {
                apiName: name,
                label: obj ? obj.label : name,
                displayName: name,
                chipTitle: obj ? `${obj.label} (${name})` : name,
                chipClass: 'abn-object-chip',
                isCustom: obj ? (obj.isCustom === true || obj.isCustom === 'true') : name.endsWith('__c')
            };
        });
    }

    get _hasSelectedFields() {
        return this._selectedFieldChips.length > 0;
    }

    get _showFieldChips() {
        const prefs = getPreferences();
        if (prefs.showFieldChips === false) return false;
        // Only show when editor is focused AND there are visible chips or actively loading
        if (!this._soqlEditorFocused && !this._fieldChipFilter) return false;
        return this._fieldChipFilter && (this._visibleFieldChips.length > 0 || this._fieldChipsLoading);
    }

    get fieldChipsClass() {
        return `abn-field-chips${this._fieldChipsLoading ? ' abn-field-chips--loading' : ''}`;
    }

    /** Shared filtered-fields list for field chips — only shows matches when user is typing */
    get _filteredFieldsForChips() {
        if (this._activeTab !== 'soqlExplorer') return [];
        if (!this._fieldChipFilter) return [];
        const search = this._fieldChipFilter.toLowerCase();
        const selectedSet = new Set(this._selectedFieldChips.map(s => s.apiName.toLowerCase()));
        return this._objectFields.filter(f =>
            !selectedSet.has(f.apiName.toLowerCase()) &&
            (f.apiName.toLowerCase().includes(search) ||
             (f.label && f.label.toLowerCase().includes(search)))
        );
    }

    get _visibleFieldChips() {
        return this._filteredFieldsForChips.slice(0, MAX_VISIBLE_CHIPS).map(f => ({
            ...f,
            chipClass: 'abn-field-chip',
            chipTitle: `${f.label} (${f.type})`,
            typeBadgeStyle: ''
        }));
    }

    get _availableFieldCount() {
        return this._filteredFieldsForChips.length;
    }

    get _hasMoreFields() {
        return this._availableFieldCount > MAX_VISIBLE_CHIPS;
    }

    get _moreFieldsCount() {
        return this._availableFieldCount - MAX_VISIBLE_CHIPS;
    }

    get editorWrapperStyle() {
        return '';
    }

    get editorContainerStyle() {
        const prefs = getPreferences();
        const fs = prefs.soqlEditorFontSize || 13;
        return `--abn-editor-font-size:${fs}px;min-height:120px;`;
    }

    /* ─── Query Tab computed for template ─── */
    get _queryTabsForTemplate() {
        return this._queryTabs;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — RECORD INSPECTOR
       ═══════════════════════════════════════════════ */

    get _currentRiTab() {
        const tabs = this.__riTabs || [];
        return tabs.find(t => t.id === this._activeRiTabId) || tabs[0];
    }

    /* ─── Proxy getters: read from active tab ─── */
    get _riRecordId() { return this._currentRiTab ? this._currentRiTab.recordId : ''; }
    get _riRecord() { return this._currentRiTab ? this._currentRiTab.record : null; }
    get _riIsLoading() { return this._currentRiTab ? this._currentRiTab.isLoading : false; }
    get _riSaving() { return this._currentRiTab ? this._currentRiTab.saving : false; }
    get _riView() { return this._currentRiTab ? this._currentRiTab.view : 'fields'; }
    get _riFieldSearch() { return this._currentRiTab ? this._currentRiTab.fieldSearch : ''; }
    get _riFieldFilter() { return this._currentRiTab ? this._currentRiTab.fieldFilter : 'all'; }
    get _riPopulatedOnly() { return this._currentRiTab ? this._currentRiTab.populatedOnly : false; }
    get _riEditMode() { return this._currentRiTab ? this._currentRiTab.editMode : false; }
    get _riDraftValues() { return this._currentRiTab ? this._currentRiTab.draftValues : {}; }
    get _riRelatedLists() { return this._currentRiTab ? this._currentRiTab.relatedLists : []; }
    get _riRelatedLoading() { return this._currentRiTab ? this._currentRiTab.relatedLoading : false; }
    get _riHistory() { return this._currentRiTab ? this._currentRiTab.history : []; }
    get _riHistoryLoading() { return this._currentRiTab ? this._currentRiTab.historyLoading : false; }

    get _riShowFieldsView() { return this._riView === 'fields'; }
    get _riShowRelatedView() { return this._riView === 'related'; }
    get _riShowHistoryView() { return this._riView === 'history'; }

    get riFieldsViewClass() { return `abn-ri-view-btn${this._riView === 'fields' ? ' abn-ri-view-btn--active' : ''}`; }
    get riRelatedViewClass() { return `abn-ri-view-btn${this._riView === 'related' ? ' abn-ri-view-btn--active' : ''}`; }
    get riHistoryViewClass() { return `abn-ri-view-btn${this._riView === 'history' ? ' abn-ri-view-btn--active' : ''}`; }

    get _riHasRelated() { return this._riRelatedLists.length > 0; }
    get _riHasHistory() { return this._riHistory.length > 0; }

    /* ─── RI Tab bar computed ─── */
    get _riTabs() {
        const tabs = this.__riTabs || [];
        const activeId = this._activeRiTabId;
        return tabs.map((t, i) => ({
            ...t,
            tabClass: `abn-query-tab${t.id === activeId ? ' abn-query-tab--active' : ''}`,
            canClose: i > 0
        }));
    }

    set _riTabs(val) {
        this.__riTabs = val;
    }

    get _canAddRiTab() {
        return (this.__riTabs || []).length < MAX_RI_TABS;
    }

    _updateActiveRiTab(partial) {
        const tabs = this.__riTabs;
        if (!tabs) return;
        const idx = tabs.findIndex(t => t.id === this._activeRiTabId);
        if (idx === -1) return;
        const updated = [...tabs];
        updated[idx] = { ...tabs[idx], ...partial };
        this.__riTabs = updated;
    }

    get _riFilteredFields() {
        if (this._activeTab !== 'recordInspector') return [];
        if (!this._riRecord || !this._riRecord.fields) return [];
        const cacheKey = `${this._riRecord.recordId}|${this._riFieldSearch}|${this._riFieldFilter}|${this._riPopulatedOnly}|${this._riEditMode}`;
        if (this.__riFieldsCacheKey === cacheKey && this.__riFieldsCache) return this.__riFieldsCache;

        let fields = this._riRecord.fields;
        const search = (this._riFieldSearch || '').toLowerCase();
        if (search) {
            fields = fields.filter(f =>
                f.apiName.toLowerCase().includes(search) ||
                (f.label && f.label.toLowerCase().includes(search))
            );
        }
        if (this._riFieldFilter !== 'all') {
            switch (this._riFieldFilter) {
                case 'standard': fields = fields.filter(f => !f.isCustom); break;
                case 'custom': fields = fields.filter(f => f.isCustom); break;
                case 'updateable': fields = fields.filter(f => f.isUpdateable); break;
                case 'required': fields = fields.filter(f => f.isRequired); break;
                default: break;
            }
        }
        if (this._riPopulatedOnly) {
            fields = fields.filter(f => f.hasValue);
        }
        const drafts = this._riDraftValues;
        const editing = this._riEditMode;
        const result = fields.map(f => {
            const isEditing = editing && f.canEdit;
            const hasDraft = drafts[f.apiName] !== undefined;
            return {
                ...f,
                badgeClass: `abn-badge abn-badge--${this._typeBadgeVariant(f.type)}`,
                isEditing,
                draftValue: hasDraft ? drafts[f.apiName] : f.editValue,
                draftBooleanValue: hasDraft ? (drafts[f.apiName] === true || drafts[f.apiName] === 'true') : f.booleanValue,
                draftDateValue: hasDraft ? drafts[f.apiName] : f.dateValue,
                draftDateTimeValue: hasDraft ? drafts[f.apiName] : f.dateTimeValue
            };
        });
        this.__riFieldsCacheKey = cacheKey;
        this.__riFieldsCache = result;
        return result;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — APEX RUNNER
       ═══════════════════════════════════════════════ */

    get apexResultBorderStyle() {
        if (!this._apexResult) return '';
        return this._apexResult.success
            ? 'border-left:3px solid var(--abn-success)'
            : 'border-left:3px solid var(--abn-error)';
    }

    get apexStatusDotClass() {
        if (!this._apexResult) return 'abn-status-dot';
        return `abn-status-dot abn-status-dot--${this._apexResult.success ? 'success' : 'error'}`;
    }

    get _apexDebugLines() {
        if (this._activeTab !== 'apexRunner') return [];
        if (!this._apexResult || !this._apexResult.debugOutput) return [];
        const src = this._apexResult.debugOutput;
        if (this.__debugLinesSrc === src) return this.__debugLinesCache;
        const lines = src.split('\n');
        const result = lines.map((text, i) => ({
            id: `dbg-${i}`,
            text,
            lineClass: `abn-apex-debug-line${text.includes('[DEBUG]') ? ' abn-apex-debug-line--debug' : ''}${text.includes('ERROR') || text.includes('EXCEPTION') ? ' abn-apex-debug-line--error' : ''}`
        }));
        this.__debugLinesSrc = src;
        this.__debugLinesCache = result;
        return result;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — DATA LOADER
       ═══════════════════════════════════════════════ */

    get _dlStep1() { return this._dlStep === 1; }
    get _dlStep2() { return this._dlStep === 2; }
    get _dlStep3() { return this._dlStep === 3; }
    get _dlStep4() { return this._dlStep === 4; }
    get _dlStep5() { return this._dlStep === 5; }
    get _dlIsUpsert() { return this._dlOperation === 'upsert'; }

    get _dlOperations() {
        return DATA_LOADER_OPERATIONS.map(op => ({
            ...op,
            btnClass: `abn-btn${this._dlOperation === op.value ? ' abn-btn--primary' : ''}`
        }));
    }

    get _dlStep1Invalid() {
        return !this._dlSelectedObject || !this._dlOperation;
    }

    get _dlStep2Invalid() {
        return !this._dlParsedData || this._dlParsedData.rows.length === 0;
    }

    get _dlStep3Invalid() {
        return !this._dlMappings.some(m => m.sfField);
    }

    get _dlRecordCount() {
        return this._dlParsedData ? this._dlParsedData.rows.length : 0;
    }

    get _dlBatchCount() {
        if (!this._dlParsedData) return 0;
        return Math.ceil(this._dlParsedData.rows.length / this._dlBatchSize);
    }

    get _dlParsePreview() {
        if (!this._dlParsedData) return null;
        return {
            headerCount: this._dlParsedData.headers.length,
            rowCount: this._dlParsedData.rows.length
        };
    }

    get dlProgressStyle() {
        const pct = this._dlBatchCount > 0 ? Math.round((this._dlCurrentBatch / this._dlBatchCount) * 100) : 0;
        return `width:${pct}%`;
    }

    get _dlResultFailures() {
        return this._dlResultTotal - this._dlResultSuccess;
    }

    get _dlWizardSteps() {
        const labels = ['Select', 'Import', 'Map', 'Execute', 'Results'];
        const steps = [];
        labels.forEach((label, i) => {
            const num = i + 1;
            const isComplete = num < this._dlStep;
            let cls = 'abn-wizard-step';
            if (isComplete) cls += ' abn-wizard-step--complete';
            else if (num === this._dlStep) cls += ' abn-wizard-step--active';
            steps.push({
                key: `step-${num}`,
                dotContent: isComplete ? '\u2713' : num,
                label,
                stepClass: cls,
                showLine: i < labels.length - 1,
                lineKey: `line-${num}`
            });
        });
        return steps;
    }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — ONBOARDING
       ═══════════════════════════════════════════════ */

    get _onboardingStep() {
        return ONBOARDING_STEPS[this._onboardingIndex] || ONBOARDING_STEPS[0];
    }

    get _onboardingDots() {
        return ONBOARDING_STEPS.map((_, i) => ({
            index: i,
            dotClass: `abn-onboarding__dot${i === this._onboardingIndex ? ' abn-onboarding__dot--active' : ''}`,
            ariaLabel: `Step ${i + 1}`
        }));
    }

    get _onboardingCanSkip() { return this._onboardingIndex === 0; }
    get _onboardingCanBack() { return this._onboardingIndex > 0; }
    get _onboardingIsLast() { return this._onboardingIndex === ONBOARDING_STEPS.length - 1; }


    /* ═══════════════════════════════════════════════
       COMPUTED PROPERTIES — PREFERENCES
       ═══════════════════════════════════════════════ */

    get _prefTheme() { return getPreferences().theme; }
    get _prefEditorFontSize() { return String(getPreferences().soqlEditorFontSize); }
    get _prefDefaultTab() { return getPreferences().defaultTab; }
    get _prefAutocomplete() { return getPreferences().autoCompleteEnabled; }
    get _prefSyntaxHighlighting() { return getPreferences().syntaxHighlighting; }
    get _prefFieldChips() { return getPreferences().showFieldChips; }
    get _prefRowNumbers() { return getPreferences().showRowNumbers; }
    get _prefConfirmDestructive() { return getPreferences().confirmDestructive; }


    /* ═══════════════════════════════════════════════
       HANDLERS — SHELL / NAVIGATION
       ═══════════════════════════════════════════════ */

    handleTabClick(event) {
        const tabId = event.currentTarget.dataset.tab;
        if (tabId) {
            this._activeTab = tabId;
            this._ensureSoqlReady(tabId);
            if (tabId === 'dataLoader' && !this._allObjects) {
                this._prefetchObjects();
            }
        }
    }

    _soqlInitDone = false;
    _ensureSoqlReady(tabId) {
        if (tabId === 'soqlExplorer' && !this._soqlInitDone) {
            this._soqlInitDone = true;
            this._prefetchObjects();
            const defaultQuery = this._currentTab ? this._currentTab.query : '';
            if (defaultQuery) {
                this._detectObjectFromQuery(defaultQuery);
            }
        }
    }

    handleToggleTheme() {
        this._theme = this._theme === 'dark' ? 'light' : 'dark';
        setPreference('theme', this._theme);
        this._applyTheme();
    }

    handleShowPreferences() {
        this._showPreferences = true;
    }

    handleClosePreferences(event) {
        if (event && event.target !== event.currentTarget) return;
        this._showPreferences = false;
    }

    handleModalStopProp(event) {
        event.stopPropagation();
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — TOAST
       ═══════════════════════════════════════════════ */

    _showToast(message, variant = 'info', durationMs = 4000) {
        this._toast = { message, variant };
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { this._toast = null; }, durationMs);
    }

    handleDismissToast() {
        this._toast = null;
        if (this._toastTimer) clearTimeout(this._toastTimer);
    }

    /* ═══════════════════════════════════════════════
       HANDLERS — SOQL EXPLORER: EDITOR
       ═══════════════════════════════════════════════ */

    handleSoqlInput(event) {
        const query = event.target.value;
        const cursor = event.target.selectionStart;
        this._updateActiveTab({ query, error: null });
        this._syncEditorHighlight();
        // Debounce expensive parsing — don't run on every single character
        if (this._soqlInputTimer) clearTimeout(this._soqlInputTimer);
        this._soqlInputTimer = setTimeout(() => {
            this._detectObjectFromQuery(query);
            this._rebuildSelectedFieldChips();
            this._syncFieldChipFilter(query, cursor);
        }, 80);
        this._debouncedAutocomplete(query, cursor);
    }

    handleSoqlKeydown(event) {
        const key = event.key;

        /* Ctrl+Enter → Execute */
        if ((event.ctrlKey || event.metaKey) && key === 'Enter') {
            event.preventDefault();
            this.handleExecuteQuery();
            return;
        }

        /* Ctrl+Space → Force autocomplete */
        if ((event.ctrlKey || event.metaKey) && key === ' ') {
            event.preventDefault();
            this._triggerAutocomplete(this._currentQuery, event.target.selectionStart);
            return;
        }

        /* Tab → insert 2 spaces (only when autocomplete is closed) */
        if (key === 'Tab' && !this._showAutocomplete) {
            event.preventDefault();
            const ta = event.target;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
            this._updateCurrentTabQuery(ta.value);
            this._syncEditorHighlight();
            return;
        }

        if (!this._showAutocomplete) return;

        switch (key) {
            case 'ArrowDown':
                event.preventDefault();
                this._activeAutocompleteIndex = Math.min(
                    this._activeAutocompleteIndex + 1,
                    this._autocompleteSuggestions.length - 1
                );
                this._scrollAutocompleteItem();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this._activeAutocompleteIndex = Math.max(this._activeAutocompleteIndex - 1, 0);
                this._scrollAutocompleteItem();
                break;
            case 'Enter':
            case 'Tab':
                if (this._activeAutocompleteIndex >= 0) {
                    event.preventDefault();
                    this._acceptAutocompleteSuggestion(this._autocompleteSuggestions[this._activeAutocompleteIndex]);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this._closeAutocomplete();
                break;
            default:
                break;
        }
    }

    handleSoqlScroll(event) {
        if (this._scrollRafPending) return;
        this._scrollRafPending = true;
        requestAnimationFrame(() => {
            const pre = this.template.querySelector('.abn-editor-highlight');
            if (pre) {
                pre.scrollTop = event.target.scrollTop;
                pre.scrollLeft = event.target.scrollLeft;
            }
            this._scrollRafPending = false;
        });
    }

    handleSoqlClick(event) {
        this._closeAutocomplete();
        const cursorPos = event.target.selectionStart;
        if (cursorPos !== undefined) {
            this._syncFieldChipFilter(this._currentQuery, cursorPos);
            // Don't auto-trigger autocomplete on click — only on keystrokes or Ctrl+Space
        }
    }

    handleSoqlFocus() {
        this._soqlEditorFocused = true;
    }

    handleSoqlBlur() {
        // Delay close so mousedown on dropdown items can register first
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this._closeAutocomplete();
            this._soqlEditorFocused = false;
        }, 300);
    }


    /* ═══════════════════════════════════════════════
       SOQL: OBJECT CHIPS
       ═══════════════════════════════════════════════ */

    handleObjectSearchInput(event) {
        this._objectSearchTerm = event.target.value;
    }

    handleObjectChipClick(event) {
        const objectName = event.currentTarget.dataset.object;
        if (!objectName) return;

        let query = this._currentQuery;
        const textarea = this.template.querySelector('.abn-editor-input');

        // If query already has FROM, replace the object name
        const fromMatch = query.match(/(\bFROM\s+)([a-zA-Z][a-zA-Z0-9_]*)/i);
        if (fromMatch) {
            const beforeFrom = query.substring(0, fromMatch.index + fromMatch[1].length);
            const afterObject = query.substring(fromMatch.index + fromMatch[0].length);
            query = beforeFrom + objectName + afterObject;
        } else if (query.trim()) {
            // Query exists but no FROM yet — append FROM <object>
            query = query.trimEnd() + ' FROM ' + objectName;
        } else {
            // Empty query — create a default template
            query = `SELECT Id, Name FROM ${objectName} LIMIT 100`;
        }

        this._updateActiveTab({ query, error: null });
        this._setEditorValue(query);
        this._syncEditorHighlight();
        this._detectedObjectName = objectName;
        this._fetchFieldsForChips(objectName);
        this._rebuildSelectedFieldChips();
        this._objectSearchTerm = '';
        if (textarea) textarea.focus();
    }


    /* ═══════════════════════════════════════════════
       SOQL: SYNTAX HIGHLIGHTING
       ═══════════════════════════════════════════════ */

    _syncEditorHighlight() {
        if (this._highlightTimer) cancelAnimationFrame(this._highlightTimer);
        this._highlightTimer = requestAnimationFrame(() => {
            const codeEl = this.template.querySelector('.abn-editor-highlight code');
            if (!codeEl) return;
            const query = this._currentQuery;
            if (this._lastHighlightedQuery === query) return;
            this._lastHighlightedQuery = query;
            const prefs = getPreferences();
            codeEl.innerHTML = prefs.syntaxHighlighting === false
                ? this._escapeHtml(query)
                : highlightSOQL(query) + '\n';
        });
    }


    /* ═══════════════════════════════════════════════
       SOQL: OBJECT DETECTION → FIELD CHIPS
       ═══════════════════════════════════════════════ */

    _detectObjectFromQuery(query) {
        const context = getQueryContext(query, query.length);
        if (context.objectName && context.objectName !== this._detectedObjectName) {
            this._detectedObjectName = context.objectName;
            this._fetchFieldsForChips(context.objectName);
        } else if (!context.objectName && this._detectedObjectName) {
            this._detectedObjectName = null;
            this._objectFields = [];
            this._selectedFieldChips = [];
        }
    }

    async _fetchFieldsForChips(objectName) {
        this._fieldChipsLoading = true;
        try {
            // Check autocomplete engine's cache first to avoid duplicate Apex call
            let fields = null;
            if (this._autocompleteEngine?.cache) {
                const cached = this._autocompleteEngine.cache.getFields(objectName);
                if (cached) {
                    fields = cached;
                }
            }
            if (!fields) {
                const detail = await getObjectDetail({ objectApiName: objectName });
                if (this._detectedObjectName !== objectName) return; // stale
                fields = detail && detail.fields ? detail.fields : [];
                // Write into autocomplete cache so future autocomplete hits use it
                if (this._autocompleteEngine?.cache && fields.length > 0) {
                    this._autocompleteEngine.cache.setFields(objectName, fields);
                }
            }
            this._objectFields = fields.map(f => ({
                apiName: f.apiName,
                label: f.label,
                type: f.type || 'STRING',
                typeIcon: FIELD_TYPE_ICONS[(f.type || 'STRING').toUpperCase()] || '',
                isCustom: f.isCustom,
                isRequired: f.isRequired,
                isNameField: f.isNameField
            }));
            this._rebuildSelectedFieldChips();
        } catch (e) {
            this._objectFields = [];
        } finally {
            this._fieldChipsLoading = false;
        }
    }

    _rebuildSelectedFieldChips() {
        const query = this._currentQuery.toUpperCase();
        const selectMatch = query.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
        if (!selectMatch) {
            this._selectedFieldChips = [];
            return;
        }
        const selectClause = selectMatch[1];
        const fieldNames = selectClause.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
        const fieldSet = new Set(fieldNames);
        this._selectedFieldChips = this._objectFields
            .filter(f => fieldSet.has(f.apiName.toLowerCase()))
            .map(f => ({
                ...f,
                removeLabel: `Remove ${f.apiName}`
            }));
    }


    /* ═══════════════════════════════════════════════
       SOQL: FIELD CHIP HANDLERS
       ═══════════════════════════════════════════════ */

    handleFieldChipClick(event) {
        const fieldName = event.currentTarget.dataset.field;
        if (!fieldName) return;
        this._insertFieldIntoQuery(fieldName);
    }

    handleRemoveFieldChip(event) {
        event.stopPropagation();
        const fieldName = event.currentTarget.dataset.field;
        if (!fieldName) return;
        this._removeFieldFromQuery(fieldName);
    }

    handleFieldChipFilterInput(event) {
        this._fieldChipFilter = event.target.value;
    }

    handleShowAllFields() {
        this._fieldChipFilter = '';
    }

    /**
     * Derive field chip filter from cursor context — chips only appear
     * when the user is actively typing a field name (at least 1 char).
     */
    _syncFieldChipFilter(query, cursorPos) {
        if (!this._detectedObjectName) {
            this._fieldChipFilter = '';
            return;
        }
        const ctx = getQueryContext(query, cursorPos);
        const isFieldClause = ctx.expectedNext === 'field';
        this._fieldChipFilter = isFieldClause ? ctx.currentWord : '';
    }

    _insertFieldIntoQuery(fieldName) {
        const textarea = this.template.querySelector('.abn-editor-input');
        let query = this._currentQuery;
        const cursorPos = textarea ? textarea.selectionStart : query.length;
        const context = getQueryContext(query, cursorPos);

        // If cursor is in WHERE, ORDER, GROUP, or HAVING — insert at cursor position
        if (['WHERE', 'ORDER', 'GROUP', 'HAVING'].includes(context.clause) && textarea) {
            const tokenLen = context.token ? context.token.length : 0;
            const before = query.substring(0, cursorPos - tokenLen);
            const after = query.substring(cursorPos);
            const newQuery = before + fieldName + after;
            const newCursorPos = before.length + fieldName.length;
            this._updateActiveTab({ query: newQuery, error: null });
            this._setEditorValue(newQuery);
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
            this._syncEditorHighlight();
            this._rebuildSelectedFieldChips();
            this._fieldChipFilter = '';
            return;
        }

        // Default: append to SELECT clause
        const selectMatch = query.match(/(SELECT\s+)([\s\S]*?)(\s+FROM)/i);
        if (!selectMatch) return;

        let selectClause = selectMatch[2].trim();
        const existingFields = selectClause.split(',').map(f => f.trim().toLowerCase());

        if (existingFields.includes(fieldName.toLowerCase())) return; // already in query

        if (selectClause === '*') {
            selectClause = fieldName;
        } else {
            selectClause += ', ' + fieldName;
        }

        const newQuery = selectMatch[1] + selectClause + selectMatch[3] + query.substring(selectMatch.index + selectMatch[0].length);
        this._updateActiveTab({ query: newQuery, error: null });
        this._syncEditorHighlight();
        this._rebuildSelectedFieldChips();
        this._fieldChipFilter = '';
        this._setEditorValue(newQuery);
        if (textarea) textarea.focus();
    }

    _removeFieldFromQuery(fieldName) {
        let query = this._currentQuery;
        const selectMatch = query.match(/(SELECT\s+)([\s\S]*?)(\s+FROM)/i);
        if (!selectMatch) return;

        let fields = selectMatch[2].split(',').map(f => f.trim());
        fields = fields.filter(f => f.toLowerCase() !== fieldName.toLowerCase());
        if (fields.length === 0) fields = ['Id'];

        const newQuery = selectMatch[1] + fields.join(', ') + selectMatch[3] + query.substring(selectMatch.index + selectMatch[0].length);
        this._updateActiveTab({ query: newQuery, error: null });
        this._syncEditorHighlight();
        this._rebuildSelectedFieldChips();
        this._setEditorValue(newQuery);
    }

    _setEditorValue(value) {
        const textarea = this.template.querySelector('.abn-editor-input');
        if (textarea) {
            textarea.value = value;
        }
    }


    /* ═══════════════════════════════════════════════
       SOQL: AUTOCOMPLETE
       ═══════════════════════════════════════════════ */

    _debouncedAutocomplete(query, cursorPos) {
        const prefs = getPreferences();
        if (prefs.autoCompleteEnabled === false) return;

        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._triggerAutocomplete(query, cursorPos);
        }, DEBOUNCE_MS);
    }

    async _triggerAutocomplete(query, cursorPos) {
        const requestId = ++this._autocompleteRequestId;
        try {
            const result = await this._autocompleteEngine.getSuggestions(query, cursorPos);
            if (this._autocompleteRequestId !== requestId) return; // stale

            if (result.suggestions && result.suggestions.length > 0) {
                const all = result.suggestions;
                this._autocompleteSuggestionsTotal = all.length;
                this._autocompleteSuggestions = all.slice(0, 30).map((s, i) => ({
                    ...s,
                    id: `ac-${i}`,
                    index: i,
                    icon: this._suggestionIcon(s),
                    sublabel: s.type === 'field' ? (s.fieldType || '') : '',
                    typeLabel: s.type,
                    chipTitle: s.label || s.value,
                    isActive: i === 0,
                    chipClass: `abn-suggestion-chip${i === 0 ? ' selected' : ''}`
                }));
                this._activeAutocompleteIndex = 0;
                this._showAutocomplete = true;
            } else {
                this._closeAutocomplete();
            }
        } catch (e) {
            this._closeAutocomplete();
        }
    }

    _closeAutocomplete() {
        this._showAutocomplete = false;
        this._autocompleteSuggestions = [];
        this._activeAutocompleteIndex = -1;
    }

    _scrollAutocompleteItem() {
        // Scroll the active item into view without remapping the entire array
        const container = this.template.querySelector('.abn-autocomplete-list');
        if (!container) return;
        const items = container.querySelectorAll('.abn-suggestion-chip');
        items.forEach((el, i) => {
            if (i === this._activeAutocompleteIndex) {
                el.classList.add('selected');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('selected');
            }
        });
    }

    handleSelectSuggestion(event) {
        event.preventDefault(); // prevent textarea blur
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const suggestion = this._autocompleteSuggestions[index];
        if (suggestion) {
            this._acceptAutocompleteSuggestion(suggestion);
        }
    }

    handleSuggestionHover(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        this._activeAutocompleteIndex = index;
        this._scrollAutocompleteItem();
    }

    _acceptAutocompleteSuggestion(suggestion) {
        if (!suggestion) return;
        const textarea = this.template.querySelector('.abn-editor-input');
        if (!textarea) return;

        const query = textarea.value;
        const cursorPos = textarea.selectionStart;
        const beforeCursor = query.substring(0, cursorPos);

        // Find current token (dot-aware) — match full dotted expression
        const tokenMatch = beforeCursor.match(/([.\w]*)$/);
        const fullToken = tokenMatch ? tokenMatch[1] : '';

        // For relationship paths, only replace the last segment after the last dot
        const lastDotIdx = fullToken.lastIndexOf('.');
        let tokenStart;
        if (lastDotIdx >= 0) {
            tokenStart = cursorPos - (fullToken.length - lastDotIdx - 1);
        } else {
            tokenStart = cursorPos - fullToken.length;
        }

        const before = query.substring(0, tokenStart);
        const after = query.substring(cursorPos);

        // Determine insertion value and suffix based on suggestion type
        let insertValue = suggestion.value;
        let suffix = '';

        if (suggestion.type === 'object') {
            suffix = ' ';
        } else if (suggestion.type === 'keyword') {
            suffix = ' ';
        } else if (suggestion.type === 'field') {
            // If the field is a reference, insert its relationshipName with a dot for traversal
            if (suggestion.isRelationship && suggestion.relationshipName) {
                insertValue = suggestion.relationshipName;
                suffix = '.';
            }
        }

        const newQuery = before + insertValue + suffix + after;
        const newCursorPos = before.length + insertValue.length + suffix.length;

        textarea.value = newQuery;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        this._updateActiveTab({ query: newQuery, error: null });
        this._syncEditorHighlight();
        this._detectObjectFromQuery(newQuery);
        this._rebuildSelectedFieldChips();
        this._closeAutocomplete();

        // If we inserted a relationship dot, re-trigger autocomplete for traversal
        if (suffix === '.') {
            this._triggerAutocomplete(newQuery, newCursorPos);
        }
    }

    _suggestionIcon(suggestion) {
        if (suggestion.type === 'object') return suggestion.isCustom ? '&#x2B22;' : '&#x25CB;';
        if (suggestion.type === 'keyword') return '&#x2B25;';
        if (suggestion.type === 'field') return FIELD_TYPE_ICONS[(suggestion.fieldType || 'STRING').toUpperCase()] || 'Aa';
        return '';
    }


    /* ═══════════════════════════════════════════════
       SOQL: QUERY EXECUTION
       ═══════════════════════════════════════════════ */

    async handleExecuteQuery() {
        const query = this._currentQuery;
        if (!query || !query.trim()) {
            this._showToast('Query cannot be empty', 'warning');
            return;
        }

        this._updateActiveTab({ isExecuting: true, error: null, results: null, columns: [] });
        this._closeAutocomplete();
        const startTime = Date.now();
        const tabId = this._activeQueryTabId;

        try {
            const isSOSL = query.trim().toUpperCase().startsWith('FIND');

            if (isSOSL) {
                const result = await executeSOSL({ soslString: query });
                const records = [];
                const columns = [];
                if (result.objectGroups) {
                    result.objectGroups.forEach(g => {
                        if (g.records) records.push(...g.records);
                    });
                }
                const execTime = Date.now() - startTime;
                this._updateActiveTab({
                    isExecuting: false,
                    results: records,
                    totalSize: result.totalRecords || records.length,
                    columns,
                    executionTime: execTime,
                    objectName: 'SOSL'
                });
            } else {
                // Progressive batch loading via REST API cursor (no OFFSET 2000 limit)
                const PAGE_SIZE = 2000;
                const allRecords = [];
                let columns = [];
                let objectName = '';
                let nextRecordsPath = null;
                let hasMore = true;
                let isFirstPage = true;

                while (hasMore) {
                    if (this._activeQueryTabId !== tabId) break;

                    const result = await executeQueryCursor({
                        queryString: isFirstPage ? query : null,
                        nextRecordsPath,
                        batchSize: PAGE_SIZE
                    });

                    const newRecords = result.records || [];
                    for (let i = 0; i < newRecords.length; i++) {
                        allRecords.push(newRecords[i]);
                    }
                    if (!columns.length && result.columns) columns = result.columns;
                    if (!objectName && result.objectName) objectName = result.objectName;
                    hasMore = result.hasMore === true;
                    nextRecordsPath = result.nextRecordsPath;
                    isFirstPage = false;
                }

                // Single render after all batches complete
                const execTime = Date.now() - startTime;
                this._updateActiveTab({
                    isExecuting: false,
                    results: allRecords,
                    totalSize: allRecords.length,
                    columns,
                    executionTime: execTime,
                    objectName
                });
            }

            const tab = this._currentTab;
            saveToHistory({ query, rowCount: tab.totalSize, executionTime: tab.executionTime });
            this._initHistory();
            this._showToast(`${tab.totalSize} records returned (${tab.executionTime}ms)`, 'success');
        } catch (error) {
            this._updateActiveTab({
                isExecuting: false,
                error: this._extractError(error)
            });
            this._showToast('Query failed', 'error');
        } finally {
            // Guarantee spinner stops even if saveToHistory or _initHistory throws
            if (this._currentTab && this._currentTab.isExecuting) {
                this._updateActiveTab({ isExecuting: false });
            }
        }
    }


    /* ═══════════════════════════════════════════════
       SOQL: QUERY TABS
       ═══════════════════════════════════════════════ */

    handleAddQueryTab() {
        if (this._queryTabs.length >= MAX_QUERY_TABS) return;
        const num = this._queryTabs.length + 1;
        const newTab = {
            id: `tab-${Date.now()}`,
            label: `Query ${num}`,
            query: '',
            results: null,
            columns: [],
            totalSize: 0,
            executionTime: 0,
            error: null,
            isExecuting: false,
            objectName: null
        };
        this._queryTabs = [...this._queryTabs, newTab];
        this._activeQueryTabId = newTab.id;
        this._detectedObjectName = null;
        this._objectFields = [];
        this._selectedFieldChips = [];
        this._setEditorValue('');
        this._syncEditorHighlight();
    }

    handleCloseQueryTab(event) {
        event.stopPropagation();
        const tabId = event.currentTarget.dataset.id;
        if (this._queryTabs.length <= 1) return;
        const idx = this._queryTabs.findIndex(t => t.id === tabId);
        this._queryTabs = this._queryTabs.filter(t => t.id !== tabId);
        if (this._activeQueryTabId === tabId) {
            this._activeQueryTabId = this._queryTabs[Math.max(0, idx - 1)].id;
            const tab = this._currentTab;
            this._setEditorValue(tab.query);
            this._syncEditorHighlight();
            this._detectObjectFromQuery(tab.query);
        }
    }

    handleSwitchQueryTab(event) {
        const tabId = event.currentTarget.dataset.id;
        if (tabId === this._activeQueryTabId) return;
        this._activeQueryTabId = tabId;
        const tab = this._currentTab;
        this._setEditorValue(tab.query);
        this._syncEditorHighlight();
        this._detectObjectFromQuery(tab.query);
        this._closeAutocomplete();
    }

    _updateActiveTab(partial) {
        const tabs = this.__queryTabs;
        if (!tabs) return;
        const idx = tabs.findIndex(t => t.id === this._activeQueryTabId);
        if (idx === -1) return;
        // For query-only updates (typing), mutate in place to avoid re-render
        if (Object.keys(partial).length === 2 && partial.query !== undefined && partial.error === null) {
            tabs[idx] = { ...tabs[idx], query: partial.query, error: null };
            return;
        }
        const updated = [...tabs];
        updated[idx] = { ...tabs[idx], ...partial };
        this.__queryTabs = updated;
    }

    /* Computed for template — add tabClass and canClose */
    get _queryTabs() {
        const tabs = this.__queryTabs || [];
        const activeId = this._activeQueryTabId;
        const canClose = tabs.length > 1;
        return tabs.map(t => ({
            ...t,
            tabClass: `abn-query-tab${t.id === activeId ? ' abn-query-tab--active' : ''}`,
            canClose
        }));
    }

    set _queryTabs(val) {
        this.__queryTabs = val;
    }


    /* ═══════════════════════════════════════════════
       SOQL: HISTORY & SAVED QUERIES
       ═══════════════════════════════════════════════ */

    handleToggleHistory() {
        this._showHistory = !this._showHistory;
        if (this._showHistory) this._initHistory();
    }

    handleClearHistory() {
        clearHistory();
        this._queryHistory = [];
    }

    handleLoadHistoryQuery(event) {
        const id = event.currentTarget.dataset.id;
        const entry = this._queryHistory.find(h => h.id === id);
        if (entry) {
            this._updateActiveTab({ query: entry.query, error: null });
            this._setEditorValue(entry.query);
            this._syncEditorHighlight();
            this._detectObjectFromQuery(entry.query);
            this._showHistory = false;
        }
    }

    handleShowSaveDialog() {
        this._saveQueryName = '';
        this._showSaveDialog = true;
    }

    handleCloseSaveDialog(event) {
        if (event && event.target !== event.currentTarget) return;
        this._showSaveDialog = false;
    }

    handleSaveQueryNameInput(event) {
        this._saveQueryName = event.target.value;
    }

    handleConfirmSaveQuery() {
        if (!this._saveQueryName.trim()) return;
        this._savedQueries = saveQuery(this._saveQueryName.trim(), this._currentQuery);
        this._showSaveDialog = false;
        this._showToast('Query saved', 'success');
    }

    handleLoadSavedQuery(event) {
        const id = event.currentTarget.dataset.id;
        const entry = this._savedQueries.find(q => q.id === id);
        if (entry) {
            this._updateActiveTab({ query: entry.query, error: null });
            this._setEditorValue(entry.query);
            this._syncEditorHighlight();
            this._detectObjectFromQuery(entry.query);
        }
    }

    handleDeleteSavedQuery(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        this._savedQueries = deleteSavedQuery(id);
    }


    /* ═══════════════════════════════════════════════
       SOQL: EXPORT
       ═══════════════════════════════════════════════ */

    async handleExportCSV() {
        const tab = this._currentTab;
        if (!tab || !tab.results || !tab.columns) return;

        const content = buildCSVContent(tab.columns, tab.results);
        const fileName = `${tab.objectName || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
        try {
            const docId = await createExportFile({ fileName, fileContent: content });
            if (docId) {
                window.open(`/sfc/servlet.shepherd/document/download/${docId}`, '_blank');
                this._showToast('Export ready', 'success');
            }
        } catch (e) {
            this._showToast('Export failed: ' + this._extractError(e), 'error');
        }
    }


    /* ═══════════════════════════════════════════════
       SOQL: QUERY PLAN
       ═══════════════════════════════════════════════ */

    async handleQueryPlan() {
        if (!this._currentQuery) return;
        this._showQueryPlan = true;
        this._queryPlanLoading = true;
        this._queryPlanJson = '';
        try {
            const plan = await getQueryPlan({ queryString: this._currentQuery });
            this._queryPlanJson = JSON.stringify(plan, null, 2);
        } catch (e) {
            this._queryPlanJson = 'Error: ' + this._extractError(e);
        } finally {
            this._queryPlanLoading = false;
        }
    }

    handleCloseQueryPlan(event) {
        if (event && event.target !== event.currentTarget) return;
        this._showQueryPlan = false;
    }


    /* ═══════════════════════════════════════════════
       SOQL: INLINE EDITING & ROW ACTIONS
       ═══════════════════════════════════════════════ */

    handleRowSelection(event) {
        this._selectedRows = event.detail.selectedRows || [];
    }

    handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;
        switch (action.name) {
            case 'inspect':
                this._activeTab = 'recordInspector';
                this._inspectRecordById(row.Id);
                break;
            case 'delete':
                this._requestDelete(`Delete record ${row.Id}?`, async () => {
                    try {
                        await deleteRecord({ recordId: row.Id });
                        this._showToast('Record deleted', 'success');
                        this.handleExecuteQuery();
                    } catch (e) {
                        const msg = this._extractError(e);
                        if (this._isChildRecordError(msg)) {
                            this._showCascadeDeletePrompt([row.Id], 0, 1, [msg]);
                        } else {
                            this._showToast('Delete failed: ' + msg, 'error');
                        }
                    }
                });
                break;
            default: break;
        }
    }

    handleInlineEditSave(event) {
        this._draftValues = event.detail.draftValues;
    }

    _soqlInlineSaving = false;

    async handleSaveInlineEdits() {
        if (!this._draftValues.length) return;
        this._soqlInlineSaving = true;
        try {
            const results = await Promise.allSettled(
                this._draftValues.map(draft => {
                    const { Id, ...fieldValues } = draft;
                    const fields = { Id, ...fieldValues };
                    return ldsUpdateRecord({ fields });
                })
            );

            const succeeded = [];
            const failed = [];
            results.forEach((result, i) => {
                if (result.status === 'fulfilled') {
                    succeeded.push(this._draftValues[i]);
                } else {
                    failed.push({ draft: this._draftValues[i], error: this._extractError(result.reason) });
                }
            });

            // Update client-side results for successful saves (immediate reflection)
            if (succeeded.length > 0) {
                const tab = this._currentTab;
                if (tab && tab.results) {
                    const updatedResults = tab.results.map(row => {
                        const match = succeeded.find(d => d.Id === row.Id);
                        return match ? { ...row, ...match, Id: row.Id } : row;
                    });
                    this._updateActiveTab({ results: updatedResults });
                }
            }

            if (failed.length === 0) {
                this._draftValues = [];
                this._showToast(`${succeeded.length} record(s) updated`, 'success');
            } else if (succeeded.length === 0) {
                this._showToast(`All ${failed.length} record(s) failed: ${failed[0].error}`, 'error');
            } else {
                // Partial success — keep only failed drafts
                const failedIds = new Set(failed.map(f => f.draft.Id));
                this._draftValues = this._draftValues.filter(d => failedIds.has(d.Id));
                this._showToast(`${succeeded.length} saved, ${failed.length} failed: ${failed[0].error}`, 'warning');
            }
        } catch (e) {
            this._showToast('Update failed: ' + this._extractError(e), 'error');
        } finally {
            this._soqlInlineSaving = false;
        }
    }

    async handleBulkDelete() {
        const ids = this._selectedRows.map(r => r.Id).filter(Boolean);
        if (!ids.length) return;
        this._requestDelete(`Delete ${ids.length} record(s)?`, async () => {
            const BATCH_SIZE = 200;
            let totalSuccess = 0;
            let totalFail = 0;
            const allErrors = [];
            try {
                for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                    const batch = ids.slice(i, i + BATCH_SIZE);
                    const result = await bulkDeleteRecords({ recordIds: batch });
                    totalSuccess += result.successCount;
                    totalFail += result.failureCount;
                    if (result.errors && result.errors.length) {
                        allErrors.push(...result.errors);
                    }
                }
                this._selectedRows = [];
                if (totalFail === 0) {
                    this._showToast(`${totalSuccess} records deleted`, 'success');
                } else if (allErrors.some(e => e.includes('DELETE_RESTRICTED') || e.includes('is associated with'))) {
                    this._showCascadeDeletePrompt(ids, totalSuccess, totalFail, allErrors);
                } else {
                    this._showToast(`${totalSuccess} deleted, ${totalFail} failed: ${allErrors.slice(0, 3).join('; ')}`, 'error');
                }
                this.handleExecuteQuery();
            } catch (e) {
                this._showToast('Bulk delete failed: ' + this._extractError(e), 'error');
            }
        });
    }

    handleToggleChart() {
        this._showChart = !this._showChart;
        // Chart implementation can be added later
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — RECORD INSPECTOR
       ═══════════════════════════════════════════════ */

    /* ─── RI Tab handlers ─── */

    handleAddRiTab() {
        if (!this._canAddRiTab) return;
        const num = (this.__riTabs || []).length + 1;
        const newTab = this._createRiTab(`ri-tab-${Date.now()}`, `New Tab`);
        this._riTabs = [...(this.__riTabs || []), newTab];
        this._activeRiTabId = newTab.id;
    }

    handleCloseRiTab(event) {
        event.stopPropagation();
        const tabId = event.currentTarget.dataset.id;
        const tabs = this.__riTabs || [];
        // Never close the first tab
        if (tabs.length <= 1 || tabs[0].id === tabId) return;
        const idx = tabs.findIndex(t => t.id === tabId);
        this._riTabs = tabs.filter(t => t.id !== tabId);
        if (this._activeRiTabId === tabId) {
            this._activeRiTabId = this.__riTabs[Math.max(0, idx - 1)].id;
        }
    }

    handleSwitchRiTab(event) {
        const tabId = event.currentTarget.dataset.id;
        if (tabId === this._activeRiTabId) return;
        this._activeRiTabId = tabId;
    }

    /* ─── RI Input & Inspect ─── */

    handleRiIdInput(event) {
        this._updateActiveRiTab({ recordId: event.target.value.trim() });
    }

    handleRiIdKeydown(event) {
        if (event.key === 'Enter') {
            this.handleInspectRecord();
        }
    }

    async handleInspectRecord() {
        const id = this._riRecordId || (this._riRecord && this._riRecord.recordId);
        if (!id || id.length < 15) {
            this._showToast('Enter a valid Record ID (15 or 18 characters)', 'warning');
            return;
        }
        await this._inspectRecordById(id);
    }

    async _inspectRecordById(recordId) {
        if (!recordId || recordId.length < 15) return;
        this._updateActiveRiTab({
            recordId,
            isLoading: true,
            record: null,
            editMode: false,
            draftValues: {},
            relatedLists: [],
            history: [],
            view: 'fields'
        });

        try {
            const data = await getRecordData({ recordId });
            const fieldValues = data.fieldValues || {};
            const fields = (data.fields || []).map(f => {
                const val = fieldValues[f.apiName];
                const type = (f.type || '').toUpperCase();
                const displayValue = val != null ? String(val) : '';
                const hasValue = val != null && val !== '';
                const canEdit = f.isUpdateable && !f.isCalculated;

                let booleanValue = false;
                if (type === 'BOOLEAN') {
                    booleanValue = val === true || val === 'true';
                }
                let dateValue = '';
                if (type === 'DATE' && val) {
                    dateValue = String(val).substring(0, 10);
                }
                let dateTimeValue = '';
                if (type === 'DATETIME' && val) {
                    const dt = new Date(val);
                    if (!isNaN(dt.getTime())) {
                        dateTimeValue = dt.toISOString().substring(0, 16);
                    }
                }
                const editValue = displayValue;

                const currentValue = val != null ? String(val) : '';
                const picklistOptions = (f.picklistValues || []).map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    selected: opt.value === currentValue
                }));

                const isPicklist = canEdit && (type === 'PICKLIST' || type === 'MULTIPICKLIST');
                const isBoolean = canEdit && type === 'BOOLEAN';
                const isDate = canEdit && type === 'DATE';
                const isDateTime = canEdit && type === 'DATETIME';
                const isNumber = canEdit && (type === 'INTEGER' || type === 'DOUBLE' || type === 'CURRENCY' || type === 'PERCENT' || type === 'LONG');
                const isTextarea = canEdit && type === 'TEXTAREA';
                const isText = canEdit && !isPicklist && !isBoolean && !isDate && !isDateTime && !isNumber && !isTextarea;

                return {
                    ...f,
                    displayValue, hasValue, canEdit, editValue,
                    booleanValue, dateValue, dateTimeValue, picklistOptions,
                    isPicklist, isBoolean, isDate, isDateTime, isNumber, isTextarea, isText
                };
            });
            const recordName = fieldValues.Name || fieldValues.Id || data.recordId;
            this._updateActiveRiTab({
                record: {
                    recordId: data.recordId,
                    objectApiName: data.objectApiName,
                    objectLabel: data.objectLabel,
                    recordName,
                    fieldCount: data.fieldCount,
                    createdDate: data.createdDate,
                    lastModifiedDate: data.lastModifiedDate,
                    createdByName: data.createdByName || '',
                    lastModifiedByName: data.lastModifiedByName || '',
                    fields
                },
                label: recordName,
                isLoading: false
            });
        } catch (e) {
            this._showToast('Error: ' + this._extractError(e), 'error');
            this._updateActiveRiTab({ isLoading: false });
        }
    }

    handleRiClear() {
        this._updateActiveRiTab({ recordId: '', record: null, editMode: false, label: 'New Tab' });
    }

    handleRiViewChange(event) {
        const view = event.currentTarget.dataset.view;
        this._updateActiveRiTab({ view });
        if (view === 'related' && this._riRelatedLists.length === 0) {
            this._loadRelatedLists();
        }
        if (view === 'history' && this._riHistory.length === 0) {
            this._loadFieldHistory();
        }
    }

    handleRiFieldSearch(event) {
        this._updateActiveRiTab({ fieldSearch: event.target.value });
    }

    handleRiFieldFilter(event) {
        this._updateActiveRiTab({ fieldFilter: event.target.value });
    }

    handleRiPopulatedToggle(event) {
        this._updateActiveRiTab({ populatedOnly: event.target.checked });
    }

    handleRiToggleEdit() {
        this._updateActiveRiTab({ editMode: true, draftValues: {} });
    }

    handleRiCancelEdit() {
        this._updateActiveRiTab({ editMode: false, draftValues: {} });
    }

    handleRiDraftChange(event) {
        const field = event.currentTarget.dataset.field;
        if (!field) return;
        const isCheckbox = event.target.type === 'checkbox';
        const newValue = isCheckbox ? event.target.checked : event.target.value;
        // Mutate in place — do NOT trigger reactivity, which would re-render inputs and kill typing
        const tab = this._currentRiTab;
        if (tab) tab.draftValues[field] = newValue;
    }

    async handleRiSaveEdits() {
        const originalFields = this._riRecord ? this._riRecord.fields : [];
        const originalMap = new Map(originalFields.map(f => [f.apiName, f.displayValue]));
        const booleanOrigMap = new Map(originalFields.filter(f => f.isBoolean).map(f => [f.apiName, f.booleanValue]));
        const updates = {};
        for (const [field, value] of Object.entries(this._riDraftValues)) {
            if (booleanOrigMap.has(field)) {
                const boolVal = value === true || value === 'true';
                if (boolVal !== booleanOrigMap.get(field)) {
                    updates[field] = boolVal;
                }
            } else {
                const original = originalMap.get(field) || '';
                if (value !== original) {
                    updates[field] = value === '' ? null : value;
                }
            }
        }
        if (Object.keys(updates).length === 0) {
            this._updateActiveRiTab({ editMode: false });
            this._showToast('No changes detected', 'info');
            return;
        }
        this._updateActiveRiTab({ saving: true });
        try {
            await updateRecordFields({
                recordId: this._riRecord.recordId,
                fieldUpdatesJson: JSON.stringify(updates)
            });
            const updatedFields = this._riRecord.fields.map(f => {
                if (updates.hasOwnProperty(f.apiName)) {
                    const newVal = updates[f.apiName];
                    const displayValue = newVal != null ? String(newVal) : '';
                    return {
                        ...f,
                        displayValue,
                        hasValue: newVal != null && newVal !== '',
                        editValue: displayValue,
                        booleanValue: f.isBoolean ? (newVal === true || newVal === 'true') : f.booleanValue,
                        dateValue: f.isDate && newVal ? String(newVal).substring(0, 10) : f.dateValue,
                        dateTimeValue: f.isDateTime && newVal ? String(newVal).substring(0, 16) : f.dateTimeValue
                    };
                }
                return f;
            });
            this._updateActiveRiTab({
                record: {
                    ...this._riRecord,
                    fields: updatedFields,
                    recordName: updates.Name || this._riRecord.recordName
                },
                editMode: false,
                draftValues: {},
                saving: false
            });
            this._showToast('Record updated', 'success');
        } catch (e) {
            this._showToast('Update failed: ' + this._extractError(e), 'error');
            this._updateActiveRiTab({ saving: false });
        }
    }

    handleRiDelete() {
        this._requestDelete(`Delete this ${this._riRecord.objectLabel} record?`, async () => {
            try {
                await deleteRecord({ recordId: this._riRecord.recordId });
                this._showToast('Record deleted', 'success');
                this._updateActiveRiTab({ record: null });
            } catch (e) {
                const msg = this._extractError(e);
                if (this._isChildRecordError(msg)) {
                    this._showCascadeDeletePrompt([this._riRecord.recordId], 0, 1, [msg]);
                } else {
                    this._showToast('Delete failed: ' + msg, 'error');
                }
            }
        });
    }

    handleRiCopySOQL() {
        if (!this._riRecord) return;
        const fields = this._riFilteredFields.map(f => f.apiName).join(', ');
        const query = `SELECT ${fields} FROM ${this._riRecord.objectApiName} WHERE Id = '${this._riRecord.recordId}'`;
        this._copyToClipboard(query);
        this._showToast('SOQL copied', 'success');
    }

    handleRiOpenInSF() {
        const id = this._riRecord && this._riRecord.recordId;
        if (id) {
            window.open(`/${id}`, '_blank');
        }
    }

    handleRiRelatedClick(event) {
        const objectName = event.currentTarget.dataset.object;
        const fieldName = event.currentTarget.dataset.field;
        const query = `SELECT Id, Name FROM ${objectName} WHERE ${fieldName} = '${this._riRecord.recordId}' LIMIT 100`;
        this._activeTab = 'soqlExplorer';
        this._updateActiveTab({ query, error: null });
        this._setEditorValue(query);
        this._syncEditorHighlight();
        this._detectObjectFromQuery(query);
    }

    async _loadRelatedLists() {
        this._updateActiveRiTab({ relatedLoading: true });
        try {
            const lists = await getChildRelationships({ recordId: this._riRecord.recordId }) || [];
            this._updateActiveRiTab({ relatedLists: lists, relatedLoading: false });
        } catch (e) {
            this._updateActiveRiTab({ relatedLists: [], relatedLoading: false });
            this._showToast('Could not load related lists: ' + this._extractError(e), 'warning');
        }
    }

    async _loadFieldHistory() {
        this._updateActiveRiTab({ historyLoading: true });
        try {
            const history = await getRecordHistory({ recordId: this._riRecord.recordId }) || [];
            const mapped = history.map((h, i) => ({
                ...h,
                id: `hist-${i}`,
                date: h.createdDate || '',
                oldDisplayValue: h.oldValue != null ? String(h.oldValue) : '',
                newDisplayValue: h.newValue != null ? String(h.newValue) : '',
                userName: h.createdByName || ''
            }));
            this._updateActiveRiTab({ history: mapped, historyLoading: false });
        } catch (e) {
            this._updateActiveRiTab({ history: [], historyLoading: false });
            this._showToast('Could not load field history: ' + this._extractError(e), 'warning');
        }
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — APEX RUNNER
       ═══════════════════════════════════════════════ */

    handleApexInput(event) {
        this._apexCode = event.target.value;
    }

    handleApexKeydown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.handleExecuteApex();
        }
        // Tab inserts 2 spaces
        if (event.key === 'Tab') {
            event.preventDefault();
            const ta = event.target;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
            this._apexCode = ta.value;
        }
    }

    async handleExecuteApex() {
        if (!this._apexCode || !this._apexCode.trim()) {
            this._showToast('Enter some Apex code to execute', 'warning');
            return;
        }

        // DML safety check — warn before executing code with data-modifying operations
        const dmlPattern = /\b(insert|update|delete|undelete|upsert|merge)\b/i;
        if (dmlPattern.test(this._apexCode) && !this._apexDmlConfirmed) {
            this._requestDelete('This code contains DML operations (insert/update/delete). Changes will be committed to the database. Execute anyway?', () => {
                this._apexDmlConfirmed = true;
                this.handleExecuteApex();
            });
            return;
        }
        this._apexDmlConfirmed = false;

        this._apexExecuting = true;
        this._apexResult = null;

        if (!this._traceFlagChecked) {
            try {
                await ensureTraceFlag();
                this._traceFlagChecked = true;
            } catch (e) {
                // non-fatal, continue
            }
        }

        const startTime = Date.now();
        try {
            const result = await executeAnonymousApex({ code: this._apexCode });
            const durationMs = Date.now() - startTime;

            if (result.success) {
                // Fetch execution log for debug output
                try {
                    const log = await getExecutionLog({ afterTimestamp: new Date(startTime).toISOString() });
                    this._apexResult = {
                        success: true,
                        durationMs: log ? log.durationMs : durationMs,
                        debugOutput: log ? log.debugOutput : '',
                        compiled: true
                    };
                } catch (logErr) {
                    this._apexResult = {
                        success: true,
                        durationMs,
                        debugOutput: '',
                        compiled: true
                    };
                }
                this._showToast('Execution successful', 'success');
            } else {
                this._apexResult = {
                    success: false,
                    compiled: result.compiled,
                    compileProblem: result.compileProblem || null,
                    exceptionMessage: result.exceptionMessage || null,
                    exceptionStackTrace: result.exceptionStackTrace || null,
                    line: result.line,
                    column: result.column,
                    durationMs
                };
                this._showToast('Execution failed', 'error');
            }
        } catch (e) {
            this._apexResult = {
                success: false,
                compiled: false,
                compileProblem: this._extractError(e),
                durationMs: Date.now() - startTime
            };
            this._showToast('Execution error', 'error');
        } finally {
            this._apexExecuting = false;
        }
    }

    handleClearApexEditor() {
        this._apexCode = '';
        this._apexResult = null;
    }

    handleInsertSnippet(event) {
        const label = event.currentTarget.dataset.label;
        const snippet = APEX_SNIPPETS.find(s => s.label === label);
        if (snippet) {
            this._apexCode = snippet.code;
            const ta = this.template.querySelector('.abn-panel--active textarea');
            if (ta) ta.value = snippet.code;
        }
    }

    handleToggleApexLogs() {
        this._showApexLogs = !this._showApexLogs;
        if (this._showApexLogs) this._loadApexLogs();
    }

    async _loadApexLogs() {
        this._apexLogsLoading = true;
        try {
            const logs = await getRecentLogs({ limitCount: 20 });
            this._apexLogs = (logs || []).map(log => ({
                ...log,
                relativeTime: getRelativeTime(log.startTime || log.lastModifiedDate),
                statusDotClass: `abn-status-dot abn-status-dot--${log.status === 'Success' ? 'success' : 'info'}`
            }));
        } catch (e) {
            this._apexLogs = [];
        } finally {
            this._apexLogsLoading = false;
        }
    }

    handleRefreshApexLogs() {
        this._loadApexLogs();
    }

    async handleViewApexLog(event) {
        const logId = event.currentTarget.dataset.id;
        this._showLogDetail = true;
        this._logDetailBody = 'Loading...';
        try {
            this._logDetailBody = await getLogBody({ logId });
        } catch (e) {
            this._logDetailBody = 'Error loading log: ' + this._extractError(e);
        }
    }

    handleCloseLogDetail(event) {
        if (event && event.target !== event.currentTarget) return;
        this._showLogDetail = false;
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — DATA LOADER
       ═══════════════════════════════════════════════ */

    handleDlSelectOperation(event) {
        this._dlOperation = event.currentTarget.dataset.value;
    }

    handleDlObjectSearch(event) {
        this._dlObjectSearch = event.target.value;
        this._searchDlObjects(event.target.value);
    }

    async _searchDlObjects(searchTerm) {
        if (!searchTerm || searchTerm.length < 1) {
            this._dlObjectResults = [];
            return;
        }
        if (!this._allObjects) {
            try {
                this._allObjects = await getAccessibleObjects({ searchTerm: '' });
            } catch (e) {
                this._allObjects = [];
            }
        }
        const search = searchTerm.toLowerCase();
        const matches = this._allObjects
            .filter(o => (o.apiName || '').toLowerCase().includes(search) || (o.label || '').toLowerCase().includes(search));
        // Sort: exact prefix on apiName first, then prefix on label, then rest
        matches.sort((a, b) => {
            const aApi = (a.apiName || '').toLowerCase();
            const bApi = (b.apiName || '').toLowerCase();
            const aLabel = (a.label || '').toLowerCase();
            const bLabel = (b.label || '').toLowerCase();
            const aExact = aApi === search ? 0 : aApi.startsWith(search) ? 1 : aLabel.startsWith(search) ? 2 : 3;
            const bExact = bApi === search ? 0 : bApi.startsWith(search) ? 1 : bLabel.startsWith(search) ? 2 : 3;
            if (aExact !== bExact) return aExact - bExact;
            return aApi.localeCompare(bApi);
        });
        this._dlObjectResults = [...matches.slice(0, 20)];
    }

    handleDlSelectObject(event) {
        this._dlSelectedObject = event.currentTarget.dataset.value;
        this._dlObjectSearch = '';
        this._dlObjectResults = [];
    }

    handleDlClearObject() {
        this._dlSelectedObject = '';
    }

    handleDlExternalIdInput(event) {
        this._dlExternalIdField = event.target.value.trim();
    }

    handleDlBatchSizeChange(event) {
        this._dlBatchSize = parseInt(event.target.value, 10);
    }

    handleDlNext() {
        if (this._dlStep < 5) {
            if (this._dlStep === 2 && this._dlParsedData) {
                this._prepareMappings();
            }
            this._dlStep++;
        }
    }

    handleDlBack() {
        if (this._dlStep > 1) this._dlStep--;
    }

    /* Step 2: File upload */
    handleDlFileClick() {
        const input = this.template.querySelector('input[type="file"]');
        if (input) input.click();
    }

    handleDlFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this._dlParsedData = parseCSV(e.target.result);
        };
        reader.readAsText(file);
    }

    handleDlDragOver(event) {
        event.preventDefault();
    }

    handleDlDrop(event) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this._dlParsedData = parseCSV(e.target.result);
        };
        reader.readAsText(file);
    }

    handleDlPasteInput(event) {
        const text = event.target.value;
        if (text && text.trim()) {
            this._dlParsedData = parseCSV(text);
        } else {
            this._dlParsedData = null;
        }
    }

    /* Step 3: Field mapping */
    async _prepareMappings() {
        try {
            const fields = await getFields({ objectApiName: this._dlSelectedObject });
            const op = this._dlOperation;
            this._dlTargetFields = (fields || []).filter(f => {
                if (f.apiName === 'Id') return true;
                if (op === 'insert') return f.isCreateable;
                return f.isUpdateable;
            });
            const mappings = autoMapFields(this._dlParsedData.headers, this._dlTargetFields);
            this._dlMappings = mappings.map(m => ({
                ...m,
                confidenceClass: `abn-confidence--${m.confidence}`
            }));
        } catch (e) {
            this._showToast('Error loading fields: ' + this._extractError(e), 'error');
        }
    }

    handleDlMappingChange(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.target.value;
        this._dlMappings = this._dlMappings.map((m, i) =>
            i === index ? { ...m, sfField: value, isMatched: !!value } : m
        );
    }

    /* Step 4: Execute */
    async handleDlExecute() {
        if (this._dlIsExecuting) return;
        this._dlIsExecuting = true;
        this._dlCurrentBatch = 0;
        this._dlResults = [];
        this._dlResultSuccess = 0;
        this._dlResultTotal = 0;

        const activeMappings = this._dlMappings.filter(m => m.sfField);
        const fields = activeMappings.map(m => m.sfField);
        const fieldsJson = JSON.stringify(fields);
        const rows = this._dlParsedData.rows;
        const batchSize = this._dlBatchSize;
        const totalBatches = Math.ceil(rows.length / batchSize);
        this._dlBatchCount = totalBatches;

        const allResults = [];

        for (let b = 0; b < totalBatches; b++) {
            this._dlCurrentBatch = b + 1;
            const batchRows = rows.slice(b * batchSize, (b + 1) * batchSize);
            const data = batchRows.map(row =>
                activeMappings.map(m => row[m.csvIndex] || '')
            );
            const dataJson = JSON.stringify(data);

            try {
                let result;
                switch (this._dlOperation) {
                    case 'insert':
                        result = await insertRecords({ objectApiName: this._dlSelectedObject, fieldsJson, dataJson });
                        break;
                    case 'update':
                        result = await updateRecords({ objectApiName: this._dlSelectedObject, fieldsJson, dataJson });
                        break;
                    case 'upsert':
                        result = await upsertRecords({ objectApiName: this._dlSelectedObject, externalIdField: this._dlExternalIdField, fieldsJson, dataJson });
                        break;
                    default: break;
                }
                if (result && result.rows) {
                    const offset = b * batchSize;
                    result.rows.forEach(r => {
                        allResults.push({ ...r, rowIndex: offset + r.rowIndex + 1 });
                    });
                    this._dlResultSuccess += result.successCount || 0;
                }
            } catch (e) {
                const offset = b * batchSize;
                batchRows.forEach((_, i) => {
                    allResults.push({ rowIndex: offset + i + 1, success: false, recordId: '', errorMessage: this._extractError(e) });
                });
            }
        }

        this._dlResults = allResults;
        this._dlResultTotal = rows.length;
        this._dlResultSuccess = allResults.filter(r => r.success).length;
        this._dlIsExecuting = false;
        this._dlStep = 5;
        this._showToast(`${this._dlResultSuccess} of ${this._dlResultTotal} records processed`, this._dlResultSuccess === this._dlResultTotal ? 'success' : 'warning');
    }

    handleDlReset() {
        this._dlStep = 1;
        this._dlParsedData = null;
        this._dlMappings = [];
        this._dlResults = [];
        this._dlSelectedObject = '';
        this._dlObjectSearch = '';
        this._dlExternalIdField = '';
    }

    handleDlExportResults() {
        if (!this._dlResults.length) return;
        const columns = [
            { fieldName: 'rowIndex', label: 'Row' },
            { fieldName: 'success', label: 'Success' },
            { fieldName: 'recordId', label: 'Record ID' },
            { fieldName: 'errorMessage', label: 'Error' }
        ];
        const content = buildCSVContent(columns, this._dlResults);
        this._downloadContent(content, 'data_loader_results.csv', 'text/csv');
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — ONBOARDING
       ═══════════════════════════════════════════════ */

    handleOnboardingNext() {
        if (this._onboardingIndex < ONBOARDING_STEPS.length - 1) {
            this._onboardingIndex++;
        }
    }

    handleOnboardingBack() {
        if (this._onboardingIndex > 0) {
            this._onboardingIndex--;
        }
    }

    handleOnboardingDotClick(event) {
        this._onboardingIndex = parseInt(event.currentTarget.dataset.index, 10);
    }

    handleOnboardingSkip() {
        this._completeOnboarding();
    }

    handleOnboardingComplete() {
        this._completeOnboarding();
    }

    _completeOnboarding() {
        setOnboardingComplete();
        this._showOnboarding = false;
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — PREFERENCES
       ═══════════════════════════════════════════════ */

    handlePrefThemeChange(event) {
        this._theme = event.target.value;
        setPreference('theme', this._theme);
        this._applyTheme();
    }

    handlePrefFontSizeChange(event) {
        setPreference('soqlEditorFontSize', parseInt(event.target.value, 10));
    }

    handlePrefDefaultTabChange(event) {
        setPreference('defaultTab', event.target.value);
    }

    handlePrefAutocompleteChange(event) {
        setPreference('autoCompleteEnabled', event.target.checked);
    }

    handlePrefSyntaxChange(event) {
        setPreference('syntaxHighlighting', event.target.checked);
        this._syncEditorHighlight();
    }

    handlePrefFieldChipsChange(event) {
        setPreference('showFieldChips', event.target.checked);
    }

    handlePrefRowNumbersChange(event) {
        this._showRowNumbers = event.target.checked;
        setPreference('showRowNumbers', event.target.checked);
    }

    handlePrefConfirmDestructiveChange(event) {
        setPreference('confirmDestructive', event.target.checked);
    }

    handleResetOnboarding() {
        resetOnboarding();
        this._showOnboarding = true;
        this._onboardingIndex = 0;
        this._showPreferences = false;
    }


    /* ═══════════════════════════════════════════════
       HANDLERS — DELETE CONFIRMATION
       ═══════════════════════════════════════════════ */

    _requestDelete(message, action) {
        const prefs = getPreferences();
        if (prefs.confirmDestructive !== false) {
            this._deleteConfirmMessage = message;
            this._pendingDeleteAction = action;
            this._showDeleteConfirm = true;
        } else {
            action();
        }
    }

    handleConfirmDelete() {
        this._showDeleteConfirm = false;
        if (this._pendingDeleteAction) {
            this._pendingDeleteAction();
            this._pendingDeleteAction = null;
        }
    }

    handleCancelDelete() {
        this._showDeleteConfirm = false;
        this._pendingDeleteAction = null;
    }

    /* ─── Cascade Delete ─── */

    _isChildRecordError(msg) {
        if (!msg) return false;
        const lower = msg.toLowerCase();
        return lower.includes('delete_restricted') ||
               lower.includes('is associated with') ||
               lower.includes('child relationship') ||
               lower.includes('cannot be deleted') ||
               lower.includes('entity is deleted');
    }

    _showCascadeDeletePrompt(failedIds, successCount, failCount, errors) {
        this._cascadeDeleteIds = failedIds;
        this._cascadeDeleteErrors = errors;
        this._cascadeDeleteSummary = successCount > 0
            ? `${successCount} record(s) deleted successfully, but ${failCount} record(s) failed because they have related child records.`
            : `${failCount} record(s) cannot be deleted because they have related child records.`;
        this._showCascadeConfirm = true;
    }

    handleCancelCascadeDelete() {
        this._showCascadeConfirm = false;
        this._cascadeDeleteIds = null;
        this._cascadeDeleteErrors = null;
    }

    async handleConfirmCascadeDelete() {
        if (this._cascadeDeleting) return;
        this._cascadeDeleting = true;
        this._cascadeDeleteErrors = null;
        this._cascadeDeleteSummary = 'Cascade deleting records and child records... Please wait.';

        const ids = this._cascadeDeleteIds;
        if (!ids || !ids.length) {
            this._showCascadeConfirm = false;
            this._cascadeDeleting = false;
            return;
        }

        let totalSuccess = 0;
        let totalFail = 0;
        const allErrors = [];
        try {
            for (const id of ids) {
                try {
                    const result = await cascadeDeleteRecord({ recordId: id });
                    totalSuccess += result.successCount;
                    totalFail += result.failureCount;
                    if (result.errors && result.errors.length) {
                        allErrors.push(...result.errors);
                    }
                } catch (e) {
                    totalFail++;
                    allErrors.push(this._extractError(e));
                }
            }
            this._showCascadeConfirm = false;
            this._cascadeDeleteIds = null;
            if (totalFail === 0) {
                this._showToast(`Cascade delete complete: ${totalSuccess} records removed`, 'success');
            } else {
                this._showToast(`${totalSuccess} deleted, ${totalFail} failed: ${allErrors.slice(0, 3).join('; ')}`, 'error');
            }
            this.handleExecuteQuery();
        } catch (e) {
            this._showCascadeConfirm = false;
            this._showToast('Cascade delete failed: ' + this._extractError(e), 'error');
        } finally {
            this._cascadeDeleting = false;
        }
    }


    /* ═══════════════════════════════════════════════
       UTILITIES
       ═══════════════════════════════════════════════ */

    _extractError(error) {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.body) {
            if (error.body.message) return error.body.message;
            if (typeof error.body === 'string') return error.body;
        }
        if (error.message) return error.message;
        return JSON.stringify(error);
    }

    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _mapColumnType(sfType) {
        return SF_TO_DT_TYPE[(sfType || '').toUpperCase()] || 'text';
    }

    _typeBadgeVariant(fieldType) {
        const type = (fieldType || '').toUpperCase();
        if (['REFERENCE', 'ID'].includes(type)) return 'blue';
        if (['STRING', 'TEXTAREA', 'PICKLIST', 'MULTIPICKLIST'].includes(type)) return 'grey';
        if (['BOOLEAN'].includes(type)) return 'green';
        if (['DATE', 'DATETIME'].includes(type)) return 'amber';
        if (['DOUBLE', 'INTEGER', 'CURRENCY', 'PERCENT', 'LONG'].includes(type)) return 'purple';
        if (['EMAIL', 'PHONE', 'URL'].includes(type)) return 'blue';
        return 'grey';
    }

    _copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
    }

    _downloadContent(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }
}
