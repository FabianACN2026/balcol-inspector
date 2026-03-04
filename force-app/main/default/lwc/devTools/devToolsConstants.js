/**
 * ABN AMRO Developer Tools — Constants
 * Defines modules, colors, and configuration for the 4-tool suite.
 */

export const MODULES = {
    RECORD_INSPECTOR: {
        id: 'recordInspector',
        label: 'Record Inspector',
        icon: 'utility:record_lookup',
        description: 'Inspect, edit, and manage Salesforce records',
        permissionLevel: 'standard',
        order: 0
    },
    SOQL_EXPLORER: {
        id: 'soqlExplorer',
        label: 'SOQL Explorer',
        icon: 'utility:database',
        description: 'Write and execute SOQL/SOSL queries with autocomplete',
        permissionLevel: 'power',
        order: 1
    },
    APEX_RUNNER: {
        id: 'apexRunner',
        label: 'Apex Runner',
        icon: 'utility:apex',
        description: 'Execute anonymous Apex and view debug logs',
        permissionLevel: 'power',
        order: 2
    },
    DATA_LOADER: {
        id: 'dataLoader',
        label: 'Data Loader',
        icon: 'utility:upload',
        description: 'Insert, update, and upsert records from CSV',
        permissionLevel: 'power',
        order: 3
    }
};

export const MODULE_LIST = Object.values(MODULES).sort((a, b) => a.order - b.order);

export const STORAGE_KEYS = {
    ONBOARDING_COMPLETE: 'abn_devtools_onboarding_complete',
    PREFERENCES: 'abn_devtools_preferences',
    SOQL_HISTORY: 'abn_devtools_soql_history',
    SAVED_QUERIES: 'abn_devtools_saved_queries'
};

export const MAX_QUERY_TABS = 8;
export const MAX_RI_TABS = 8;
export const MAX_HISTORY_ITEMS = 20;
export const MAX_BATCH_SIZE = 200;
export const MAX_EXPORT_RECORDS = 50000;

export const FIELD_TYPE_ICONS = {
    REFERENCE: '\uD83D\uDD17',
    STRING: 'Aa',
    TEXTAREA: '\uD83D\uDCDD',
    DATE: '\uD83D\uDCC5',
    DATETIME: '\uD83D\uDD50',
    BOOLEAN: '\u2713',
    CURRENCY: '\uD83D\uDCB0',
    INTEGER: '#',
    DOUBLE: '#',
    LONG: '#',
    EMAIL: '\u2709',
    PHONE: '\uD83D\uDCDE',
    URL: '\uD83D\uDD17',
    PICKLIST: '\u2630',
    MULTIPICKLIST: '\u2630',
    ID: '\uD83D\uDD11',
    PERCENT: '%',
    ENCRYPTEDSTRING: '\uD83D\uDD12',
    COMBOBOX: '\u2630',
    BASE64: '\uD83D\uDCC4',
    ADDRESS: '\uD83C\uDFE0',
    LOCATION: '\uD83D\uDCCD'
};

export const DATA_LOADER_OPERATIONS = [
    { value: 'insert', label: 'Insert', description: 'Create new records' },
    { value: 'update', label: 'Update', description: 'Update existing records (requires Id)' },
    { value: 'upsert', label: 'Upsert', description: 'Insert or update based on external ID' }
];

export const APEX_SNIPPETS = [
    {
        label: 'Debug Log',
        code: "System.debug('Hello World');"
    },
    {
        label: 'Query Accounts',
        code: "List<Account> accs = [SELECT Id, Name FROM Account LIMIT 10];\nfor (Account a : accs) {\n    System.debug(a.Name);\n}"
    },
    {
        label: 'DML Insert',
        code: "Account a = new Account(Name = 'Test Account');\ninsert a;\nSystem.debug('Created: ' + a.Id);"
    },
    {
        label: 'Describe Object',
        code: "Schema.DescribeSObjectResult describe = Account.SObjectType.getDescribe();\nSystem.debug('Fields: ' + describe.fields.getMap().keySet());"
    },
    {
        label: 'HTTP Callout',
        code: "HttpRequest req = new HttpRequest();\nreq.setEndpoint('https://api.example.com/data');\nreq.setMethod('GET');\nHttp http = new Http();\nHttpResponse res = http.send(req);\nSystem.debug(res.getBody());"
    },
    {
        label: 'Governor Limits',
        code: "System.debug('Queries: ' + Limits.getQueries() + '/' + Limits.getLimitQueries());\nSystem.debug('DML: ' + Limits.getDmlStatements() + '/' + Limits.getLimitDmlStatements());\nSystem.debug('Heap: ' + Limits.getHeapSize() + '/' + Limits.getLimitHeapSize());"
    }
];

export const ONBOARDING_STEPS = [
    {
        id: 'intro',
        title: 'ABN AMRO Salesforce Developer Tools',
        subtitle: 'Four powerful tools to accelerate your Salesforce development workflow.'
    },
    {
        id: 'recordInspector',
        title: 'Record Inspector',
        subtitle: 'Inspect any record by ID. View all fields, inline edit values, browse related lists, and track field history changes.',
        features: ['Field view & metadata', 'Inline editing', 'Related lists & history']
    },
    {
        id: 'soqlExplorer',
        title: 'SOQL Explorer',
        subtitle: 'Write queries with schema-aware autocomplete, field chips, syntax highlighting, and export results to CSV, JSON, or Excel.',
        features: ['Autocomplete & chips', 'Multi-tab queries', 'Export & charting']
    },
    {
        id: 'apexRunner',
        title: 'Apex Runner',
        subtitle: 'Execute anonymous Apex with one click. View parsed debug output, browse execution logs, and use built-in code snippets.',
        features: ['Code execution', 'Debug log parsing', 'Snippet library']
    },
    {
        id: 'dataLoader',
        title: 'Data Loader',
        subtitle: 'Import CSV data with auto-mapped fields. Insert, update, or upsert records in configurable batches with per-row results.',
        features: ['CSV import & mapping', 'Batch execution', 'Per-row results']
    },
    {
        id: 'terms',
        title: 'Ready to Go',
        subtitle: 'You have access to all developer tools. Use responsibly — all operations execute in your user context with full audit trail.'
    }
];
