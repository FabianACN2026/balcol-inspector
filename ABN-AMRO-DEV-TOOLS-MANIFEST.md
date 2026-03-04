# ABN AMRO Developer Tools — Project Manifest

> Complete specification for spinning up a new SFDX unlocked package project.
> Derived from Connectry Command Center, scoped to 4 tools, zero AI, ABN AMRO branded.

---

## 1. Project Configuration

### 1.1 sfdx-project.json

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "ABN-AMRO-Developer-Tools",
      "versionName": "ver 1.0",
      "versionNumber": "1.0.0.NEXT"
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "65.0",
  "packageAliases": {
    "ABN-AMRO-Developer-Tools": ""
  }
}
```

### 1.2 Package Type

| Attribute        | Value                            |
|------------------|----------------------------------|
| Type             | Unlocked Package (no namespace)  |
| API Version      | 65.0                             |
| Namespace        | (none)                           |
| Distribution     | Internal via DevOps pipeline     |
| Target Orgs      | ABN AMRO Salesforce environments |

---

## 2. Scope — 4 Tools Only

| Tool             | Included | Permission Level | Notes                                              |
|------------------|----------|------------------|----------------------------------------------------|
| SOQL Explorer    | YES      | Power Tools      | Full autocomplete, chips, history, export, charting |
| Record Inspector | YES      | Standard         | Field view, edit, delete, related lists, history    |
| Apex Runner      | YES      | Power Tools      | Anonymous execution, debug logs, snippets           |
| Data Loader      | YES      | Power Tools      | Insert, update, upsert with CSV, field mapping      |
| AI Assistant     | NO       | —                | Excluded entirely (no remote site, no custom setting)|
| REST Explorer    | NO       | —                | Excluded                                            |
| Metadata Browser | NO       | —                | Excluded                                            |
| Job Monitor      | NO       | —                | Excluded                                            |
| Org Dashboard    | NO       | —                | Excluded                                            |
| Setup Shortcuts  | NO       | —                | Excluded                                            |

---

## 3. Complete File Manifest

### 3.1 Apex Classes (8 production + 8 test = 16 files)

```
force-app/main/default/classes/
├── SecurityUtil.cls
├── SecurityUtil.cls-meta.xml
├── SecurityUtilTest.cls
├── SecurityUtilTest.cls-meta.xml
├── DevToolsAccessController.cls          (was CommandCenterAccessController)
├── DevToolsAccessController.cls-meta.xml
├── DevToolsAccessControllerTest.cls
├── DevToolsAccessControllerTest.cls-meta.xml
├── SelfOrgCalloutHelper.cls
├── SelfOrgCalloutHelper.cls-meta.xml
├── SelfOrgCalloutHelperTest.cls
├── SelfOrgCalloutHelperTest.cls-meta.xml
├── SOQLExplorerController.cls
├── SOQLExplorerController.cls-meta.xml
├── SOQLExplorerControllerTest.cls
├── SOQLExplorerControllerTest.cls-meta.xml
├── RecordInspectorController.cls
├── RecordInspectorController.cls-meta.xml
├── RecordInspectorControllerTest.cls
├── RecordInspectorControllerTest.cls-meta.xml
├── ApexRunnerController.cls
├── ApexRunnerController.cls-meta.xml
├── ApexRunnerControllerTest.cls
├── ApexRunnerControllerTest.cls-meta.xml
├── DataLoaderController.cls
├── DataLoaderController.cls-meta.xml
├── DataLoaderControllerTest.cls
└── DataLoaderControllerTest.cls-meta.xml
```

### 3.2 LWC Component (1 component, ~12 files)

```
force-app/main/default/lwc/devTools/
├── devTools.js                    (main controller)
├── devTools.html                  (template)
├── devTools.css                   (styles — ABN AMRO branded)
├── devTools.js-meta.xml           (component metadata)
├── soqlAutocomplete.js            (SOQL autocomplete engine)
├── soqlHighlighter.js             (SOQL syntax highlighting)
├── soqlTokenizer.js               (SOQL token parsing)
├── csvExporter.js                 (CSV/JSON/Excel export)
├── csvParser.js                   (CSV file parsing)
├── historyManager.js              (localStorage query history)
├── preferencesManager.js          (user preference storage)
└── devToolsConstants.js           (constants, colors, modules)
```

### 3.3 Custom Permissions (2 files)

```
force-app/main/default/customPermissions/
├── Dev_Tools_Access.customPermission-meta.xml
└── Dev_Tools_Power.customPermission-meta.xml
```

### 3.4 Permission Set (1 file)

```
force-app/main/default/permissionsets/
└── ABN_Dev_Tools_Admin.permissionset-meta.xml
```

### 3.5 Visualforce Page (2 files)

```
force-app/main/default/pages/
├── DevToolsSessionId.page
└── DevToolsSessionId.page-meta.xml
```

### 3.6 Flexipage (1 file)

```
force-app/main/default/flexipages/
└── ABN_Dev_Tools_UtilityBar.flexipage-meta.xml
```

### 3.7 Custom Application (1 file)

```
force-app/main/default/applications/
└── ABN_Developer_Tools.app-meta.xml
```

### 3.8 NOT Included (removed from Connectry)

```
# These files are NOT created:
- Connectry_AI_Settings__c (custom setting)         — no AI
- API_Key__c (custom field)                          — no AI
- AnthropicAPI (remote site setting)                 — no AI
- AIAssistantController.cls                          — no AI
- RESTExplorerController.cls                         — excluded tool
- MetadataBrowserController.cls                      — excluded tool
- JobMonitorController.cls                           — excluded tool
- OrgDashboardController.cls                         — excluded tool
- SetupShortcutsController.cls                       — excluded tool
- aiAssistant.js (LWC helper)                        — no AI
- jsonHighlighter.js (LWC helper)                    — no REST Explorer
```

**Total file count: ~25 files** (vs Connectry's ~50+)

---

## 4. ABN AMRO Design System

### 4.1 Brand Colors

| Token                           | Hex       | Usage                                |
|---------------------------------|-----------|--------------------------------------|
| `--abn-green`                   | `#00453A` | Primary brand color, accent, buttons |
| `--abn-green-light`             | `#006B5A` | Hover states, secondary actions      |
| `--abn-green-dark`              | `#003029` | Active/pressed states                |
| `--abn-teal`                    | `#009488` | Secondary accent, links              |
| `--abn-teal-light`              | `#00B8A9` | Highlights, active indicators        |
| `--abn-yellow`                  | `#F9BD20` | Warnings, feature highlights         |
| `--abn-yellow-light`            | `#FDD462` | Warning backgrounds                  |
| `--abn-grey`                    | `#878787` | Muted text, disabled states          |
| `--abn-grey-light`              | `#C4C4C4` | Borders, dividers                    |
| `--abn-white`                   | `#FFFFFF` | Card backgrounds                     |
| `--abn-off-white`               | `#F5F5F3` | Page background                      |

### 4.2 Dark Theme Tokens (Primary Mode)

```css
:host {
  /* ─── Backgrounds ─── */
  --abn-bg-primary:     #1a1f1e;    /* Dark green-tinted black */
  --abn-bg-secondary:   #222826;    /* Elevated surfaces */
  --abn-bg-tertiary:    #2a302e;    /* Tertiary surfaces */
  --abn-bg-hover:       #323836;    /* Hover state */

  /* ─── Text ─── */
  --abn-text-primary:   #E8E8E6;    /* Primary text */
  --abn-text-secondary: #A3A8A6;    /* Secondary text */
  --abn-text-tertiary:  #6E7572;    /* Muted text */

  /* ─── Accent (ABN AMRO Green) ─── */
  --abn-accent:         #009488;    /* Teal for interactive elements */
  --abn-accent-hover:   #00B8A9;    /* Hover state */
  --abn-accent-bg:      rgba(0, 148, 136, 0.12);  /* Subtle tint */
  --abn-accent-border:  rgba(0, 148, 136, 0.25);  /* Accent borders */

  /* ─── Borders ─── */
  --abn-border:         #2E3432;    /* Primary border */
  --abn-border-light:   #383E3C;    /* Light border */

  /* ─── Status ─── */
  --abn-success:        #2ECC71;    /* Green (different from brand green) */
  --abn-success-light:  #3ADB82;
  --abn-warning:        #F9BD20;    /* ABN Yellow */
  --abn-error:          #E74C3C;    /* Red */
  --abn-info:           #009488;    /* ABN Teal */

  /* ─── Shadows ─── */
  --abn-shadow-sm:      0 1px 2px rgba(0, 0, 0, 0.2);
  --abn-shadow-md:      0 2px 6px rgba(0, 0, 0, 0.25);
  --abn-shadow-lg:      0 4px 16px rgba(0, 0, 0, 0.35);

  /* ─── Typography ─── */
  --abn-font-family:       "ABN AMRO", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --abn-font-family-mono:  "SF Mono", "Menlo", "Consolas", "Inconsolata", monospace;
  --abn-font-size-xs:      11px;
  --abn-font-size-sm:      12px;
  --abn-font-size-md:      13px;
  --abn-font-size-lg:      15px;

  /* ─── Spacing ─── */
  --abn-space-xs:   4px;
  --abn-space-sm:   8px;
  --abn-space-md:   12px;
  --abn-space-lg:   16px;
  --abn-space-xl:   24px;

  /* ─── Border Radius ─── */
  --abn-radius-sm:     4px;
  --abn-radius-md:     6px;
  --abn-radius-lg:     8px;
  --abn-radius-badge:  4px;

  /* ─── Transitions ─── */
  --abn-transition-fast:   0.1s ease;
  --abn-transition-normal: 0.2s ease;

  /* ─── Syntax Highlighting ─── */
  --abn-syntax-keyword:    #80CBC4;   /* Teal (SOQL keywords) */
  --abn-syntax-function:   #F9BD20;   /* ABN Yellow (functions) */
  --abn-syntax-string:     #C3E88D;   /* Green (string literals) */
  --abn-syntax-number:     #F78C6C;   /* Orange (numbers) */
  --abn-syntax-boolean:    #82AAFF;   /* Blue (booleans) */

  /* ─── Density ─── */
  --abn-density-multiplier: 1;

  /* ─── Badge Colors ─── */
  --abn-badge-blue-bg:    rgba(0, 148, 136, 0.2);
  --abn-badge-blue-text:  #00B8A9;
  --abn-badge-green-bg:   rgba(46, 204, 113, 0.2);
  --abn-badge-green-text: #3ADB82;
  --abn-badge-amber-bg:   rgba(249, 189, 32, 0.2);
  --abn-badge-amber-text: #F9BD20;
  --abn-badge-red-bg:     rgba(231, 76, 60, 0.2);
  --abn-badge-red-text:   #E74C3C;
  --abn-badge-grey-bg:    rgba(135, 135, 135, 0.2);
  --abn-badge-grey-text:  #A3A8A6;
}
```

### 4.3 Light Theme Tokens (Optional, Toggle-Based)

```css
/* Applied when data-theme="light" */
--abn-bg-primary:     #F5F5F3;
--abn-bg-secondary:   #FFFFFF;
--abn-bg-tertiary:    #ECECEA;
--abn-bg-hover:       #E5E5E3;
--abn-text-primary:   #1A1F1E;
--abn-text-secondary: #5A5F5D;
--abn-text-tertiary:  #878787;
--abn-accent:         #00453A;
--abn-accent-hover:   #006B5A;
--abn-border:         #D4D4D2;
--abn-border-light:   #E8E8E6;
```

### 4.4 Tab Active State Gradient

```css
.abn-tab--active {
  background: linear-gradient(135deg, #009488, #00453A);
  color: #FFFFFF;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
}
```

### 4.5 Branding Elements

| Element                | Connectry Original           | ABN AMRO Version                    |
|------------------------|------------------------------|--------------------------------------|
| Logo                   | Connectry SVG (circles+line) | ABN AMRO shield or "ABN" text mark   |
| Product name           | "Command Center"             | "Developer Tools"                    |
| Header wordmark        | "CONNECTRY"                  | "ABN AMRO"                           |
| Tab accent gradient    | `#5279b2 → #4a6fa5`         | `#009488 → #00453A`                  |
| localStorage prefix    | `connectry_`                 | `abn_devtools_`                      |
| CSS variable prefix    | `--connectry-`               | `--abn-`                             |
| Onboarding headline    | "Your all-in-one toolkit..." | "ABN AMRO Salesforce Developer Tools"|
| Footer                 | "Connectry Command Center"   | "ABN AMRO Developer Tools"           |

---

## 5. Permission Architecture

### 5.1 Custom Permissions

#### Dev_Tools_Access (base)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomPermission xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>Grants access to ABN AMRO Developer Tools. Users without this permission see an access restricted message.</description>
  <label>Dev Tools Access</label>
</CustomPermission>
```

**Check:** `DevToolsAccessController.hasAccess()` at LWC load

#### Dev_Tools_Power (elevated)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomPermission xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>Grants access to elevated developer tools: SOQL Explorer, Apex Runner, and Data Loader. These tools execute user-context queries and code equivalent to Developer Console access. Only assign to trusted administrators.</description>
  <isLicensed>false</isLicensed>
  <label>Dev Tools Power</label>
</CustomPermission>
```

**Check:** `SecurityUtil.hasPowerToolsPermission()` — update to reference `Dev_Tools_Power`

### 5.2 Permission Set

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>Full access to all ABN AMRO Developer Tools features. Assign to Salesforce administrators who need developer-level tooling access.</description>
  <hasActivationRequired>false</hasActivationRequired>
  <label>ABN Dev Tools Admin</label>
  <classAccesses>
    <apexClass>SOQLExplorerController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>RecordInspectorController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>ApexRunnerController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>DataLoaderController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>DevToolsAccessController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>SecurityUtil</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <classAccesses>
    <apexClass>SelfOrgCalloutHelper</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <customPermissions>
    <enabled>true</enabled>
    <name>Dev_Tools_Access</name>
  </customPermissions>
  <customPermissions>
    <enabled>true</enabled>
    <name>Dev_Tools_Power</name>
  </customPermissions>
  <pageAccesses>
    <apexPage>DevToolsSessionId</apexPage>
    <enabled>true</enabled>
  </pageAccesses>
</PermissionSet>
```

### 5.3 Access Flow

```
Component loads
  └─ DevToolsAccessController.hasAccess()
       └─ FeatureManagement.checkPermission('Dev_Tools_Access')
            ├─ false → "Access Restricted" UI
            └─ true  → Load 4 tool tabs
                         └─ Tool action triggered
                              └─ SecurityUtil.hasPowerToolsPermission()
                                   └─ FeatureManagement.checkPermission('Dev_Tools_Power')
                                        ├─ false → AuraHandledException
                                        └─ true  → SecurityUtil.checkObjectCRUD()
                                                     └─ Execute operation
```

---

## 6. Apex Class Specifications

### 6.1 SecurityUtil.cls — Reuse As-Is (rename references only)

```
public with sharing class SecurityUtil {

  @TestVisible
  private static Boolean testPermissionOverride = null;

  // Enum
  public enum CRUDOperation { READ, CREATEABLE, UPDATEABLE, DELETEABLE }

  // Exception
  public class SecurityException extends Exception {}

  // Methods (all static, all public):
  ┌─────────────────────────────────────────────────────────────────┐
  │ hasPowerToolsPermission()                                       │
  │   → FeatureManagement.checkPermission('Dev_Tools_Power')        │
  │   → UPDATE: Change 'Connectry_Power_Tools' → 'Dev_Tools_Power' │
  ├─────────────────────────────────────────────────────────────────┤
  │ checkObjectCRUD(SObjectType, CRUDOperation)                     │
  │   → throws SecurityException on denial                          │
  ├─────────────────────────────────────────────────────────────────┤
  │ getAccessibleFields(SObjectType, List<String>, CRUDOperation)   │
  │   → returns List<String> of FLS-accessible fields               │
  ├─────────────────────────────────────────────────────────────────┤
  │ getAllAccessibleFields(SObjectType, CRUDOperation)               │
  │   → returns all accessible fields for object                    │
  ├─────────────────────────────────────────────────────────────────┤
  │ stripInaccessible(List<SObject>, CRUDOperation)                 │
  │   → wraps Security.stripInaccessible()                          │
  ├─────────────────────────────────────────────────────────────────┤
  │ sanitizeForSOQL(String)                                         │
  │   → String.escapeSingleQuotes(input.trim())                     │
  ├─────────────────────────────────────────────────────────────────┤
  │ validateObjectName(String)                                      │
  │   → Schema.getGlobalDescribe().get() validation                 │
  ├─────────────────────────────────────────────────────────────────┤
  │ validateApiName(String)                                         │
  │   → Regex ^[a-zA-Z][a-zA-Z0-9_]*$ validation                   │
  ├─────────────────────────────────────────────────────────────────┤
  │ isFieldAccessible(SObjectType, String, CRUDOperation)           │
  │   → returns Boolean for single field FLS check                  │
  └─────────────────────────────────────────────────────────────────┘
}
```

**Change required:** `'Connectry_Power_Tools'` → `'Dev_Tools_Power'` in `hasPowerToolsPermission()`

### 6.2 DevToolsAccessController.cls (was CommandCenterAccessController)

```apex
public with sharing class DevToolsAccessController {
  private static final String ACCESS_PERMISSION = 'Dev_Tools_Access';

  @AuraEnabled(cacheable=true)
  public static Boolean hasAccess() {
    return FeatureManagement.checkPermission(ACCESS_PERMISSION);
  }
}
```

### 6.3 SelfOrgCalloutHelper.cls — Reuse As-Is (rename VF page reference)

```
public with sharing class SelfOrgCalloutHelper {
  private static String cachedSessionId;

  ┌─────────────────────────────────────────────────────────┐
  │ getSessionId()                                           │
  │   → Page.DevToolsSessionId.getContent() (primary)        │
  │   → UPDATE: Change Page.ConnectrySessionId               │
  │     → Page.DevToolsSessionId                             │
  │   → UserInfo.getSessionId() (test fallback)              │
  │   → Cached per transaction (static var)                  │
  ├─────────────────────────────────────────────────────────┤
  │ @SuppressWarnings('PMD.ApexSuggestUsingNamedCred')      │
  │ createRequest(String path, String method)                │
  │   → URL.getOrgDomainUrl() + path                        │
  │   → Authorization: Bearer {sessionId}                    │
  │   → Content-Type: application/json                       │
  └─────────────────────────────────────────────────────────┘
}
```

**Change required:** `Page.ConnectrySessionId` → `Page.DevToolsSessionId`

### 6.4 SOQLExplorerController.cls — Reuse As-Is

```
public with sharing class SOQLExplorerController {

  @AuraEnabled methods:
  ┌─────────────────────────────────────────────────────────┐
  │ executeQuery(String queryString)                         │
  │   → SecurityUtil.hasPowerToolsPermission()               │
  │   → SecurityUtil.validateObjectName() (from parsed FROM) │
  │   → SecurityUtil.checkObjectCRUD(READ)                   │
  │   → Security.stripInaccessible(READABLE, records)        │
  │   → Returns QueryResult { records, objectName,           │
  │     totalSize, columns: List<ColumnInfo> }               │
  ├─────────────────────────────────────────────────────────┤
  │ executeSOSL(String soslString)                           │
  │   → Permission check + FLS enforcement                   │
  │   → Returns SOSLResult { objectGroups, totalRecords }    │
  ├─────────────────────────────────────────────────────────┤
  │ createExportFile(String fileName, String fileContent)    │
  │   → ContentVersion creation for iframe download          │
  │   → Returns ContentDocumentId                            │
  └─────────────────────────────────────────────────────────┘

  Wrapper classes:
  - QueryResult { records, objectName, totalSize, columns }
  - ColumnInfo { fieldName, label, type }
  - SOSLResult { objectGroups, totalRecords }
  - SOSLObjectGroup { objectApiName, objectLabel, recordCount, records }
}
```

### 6.5 RecordInspectorController.cls — Reuse As-Is

```
public with sharing class RecordInspectorController {

  @AuraEnabled methods:
  ┌─────────────────────────────────────────────────────────┐
  │ getRecordData(Id recordId)                               │
  │   → CRUD check + FLS field filtering                     │
  │   → Returns RecordData { recordId, objectApiName,        │
  │     objectLabel, fieldCount, fields, fieldValues,        │
  │     createdDate, lastModifiedDate, createdByName,        │
  │     lastModifiedByName }                                 │
  ├─────────────────────────────────────────────────────────┤
  │ deleteRecord(Id recordId)                                │
  │   → CRUD DELETE check + DML                              │
  ├─────────────────────────────────────────────────────────┤
  │ bulkDeleteRecords(List<Id> recordIds)                    │
  │   → Batch delete up to 200 with partial success          │
  │   → Returns BulkDeleteResult                             │
  ├─────────────────────────────────────────────────────────┤
  │ hasChildRelationships(Id recordId)                       │
  │   → Returns Boolean                                      │
  ├─────────────────────────────────────────────────────────┤
  │ getChildRelationships(Id recordId)                       │
  │   → Returns List<ChildRelationshipInfo>                  │
  ├─────────────────────────────────────────────────────────┤
  │ getRecordHistory(Id recordId)                            │
  │   → Returns List<FieldHistoryItem>                       │
  └─────────────────────────────────────────────────────────┘

  Wrapper classes:
  - RecordData { recordId, objectApiName, objectLabel, fieldCount, fields, fieldValues, ... }
  - FieldMetadata { apiName, label, type, length, isCustom, isRequired, isUpdateable, ... }
  - ChildRelationshipInfo { relationshipName, childObjectApiName, ... }
  - FieldHistoryItem { fieldApiName, fieldLabel, oldValue, newValue, ... }
  - BulkDeleteResult { totalRequested, successCount, failureCount, errors, successIds }
}
```

### 6.6 ApexRunnerController.cls — Reuse As-Is

```
public with sharing class ApexRunnerController {

  @AuraEnabled methods:
  ┌─────────────────────────────────────────────────────────┐
  │ ensureTraceFlag()                                        │
  │   → Creates/updates debug trace flag via Tooling API     │
  │   → Uses SelfOrgCalloutHelper                            │
  ├─────────────────────────────────────────────────────────┤
  │ executeAnonymousApex(String code)                        │
  │   → SecurityUtil.hasPowerToolsPermission()               │
  │   → Tooling API executeAnonymous                         │
  │   → Returns ExecutionResult { compiled, success,         │
  │     compileProblem, exceptionMessage, ... }              │
  ├─────────────────────────────────────────────────────────┤
  │ getRecentLogs(Integer limitCount)                        │
  │   → Returns List<DebugLogInfo> (max 50)                  │
  ├─────────────────────────────────────────────────────────┤
  │ getLogBody(String logId)                                 │
  │   → Returns raw debug log body text                      │
  ├─────────────────────────────────────────────────────────┤
  │ getExecutionLog(String afterTimestamp)                    │
  │   → Returns ExecutionLog { logId, durationMs, status,    │
  │     debugOutput (parsed USER_DEBUG lines), fullLog }     │
  └─────────────────────────────────────────────────────────┘

  Wrapper classes:
  - ExecutionResult { compiled, success, compileProblem, exceptionMessage, exceptionStackTrace, line, column }
  - DebugLogInfo { id, application, durationMs, location, logLength, userName, operation, ... }
  - ExecutionLog { logId, durationMs, status, debugOutput, fullLog }
}
```

### 6.7 DataLoaderController.cls — Reuse As-Is

```
public with sharing class DataLoaderController {

  @AuraEnabled methods:
  ┌─────────────────────────────────────────────────────────┐
  │ insertRecords(String objectApiName, String fieldsJson,   │
  │               String dataJson)                           │
  │   → SecurityUtil.hasPowerToolsPermission()               │
  │   → SecurityUtil.checkObjectCRUD(CREATEABLE)             │
  │   → Batch insert up to 200 records                       │
  │   → Returns DMLResult                                    │
  ├─────────────────────────────────────────────────────────┤
  │ updateRecords(String objectApiName, String fieldsJson,   │
  │               String dataJson)                           │
  │   → Same security checks (UPDATEABLE)                    │
  │   → Returns DMLResult                                    │
  ├─────────────────────────────────────────────────────────┤
  │ upsertRecords(String objectApiName, String externalIdField,│
  │               String fieldsJson, String dataJson)        │
  │   → Same security checks                                │
  │   → Returns DMLResult                                    │
  └─────────────────────────────────────────────────────────┘

  Helper methods (private):
  - buildRecords() — converts JSON arrays to SObject list
  - castValue() — type-casts strings to Apex types (17 types supported)
  - buildDMLResult() — wraps SaveResult[] / UpsertResult[]

  Wrapper classes:
  - DMLResult { totalRequested, successCount, failureCount, rows: List<RowResult> }
  - RowResult { rowIndex, success, recordId, errorMessage }
}
```

---

## 7. SOQL Explorer — Detailed Feature Specification

### 7.1 Core Features

| Feature                        | Description                                                        |
|--------------------------------|--------------------------------------------------------------------|
| Syntax highlighting            | Real-time SOQL highlighting via overlay textarea pattern            |
| Schema-aware autocomplete      | Object, field, keyword suggestions with relevance scoring          |
| Relationship traversal         | Dot-notation support up to 4 levels deep (Account.Owner.Profile.Name) |
| Reactive field chips           | Available fields shown as clickable chips after FROM clause typed   |
| Multi-tab queries              | Up to 8 concurrent query tabs with independent state               |
| Query history                  | localStorage, max 20 entries, relative timestamps                  |
| Saved queries                  | Named queries with toolbar chip favorites                          |
| CSV/JSON/Excel export          | Server-side ContentVersion download (iframe sandbox safe)          |
| Inline record editing          | Draft values + partial success save via updateRecord               |
| Bulk delete                    | Checkbox selection + batched delete (200/batch)                    |
| Row actions                    | Delete single record, Inspect record (navigate to Record Inspector)|
| Query plan analysis            | REST API EXPLAIN endpoint visualization                            |
| Result charting                | Bar/pie charts with field selection (SVG-based)                    |
| SOSL support                   | FIND queries with grouped results by object                       |

### 7.2 Autocomplete Engine (soqlAutocomplete.js)

#### Class: `SoqlAutocompleteEngine`

**Constructor config:**
```javascript
{
  fetchObjects: (searchTerm) => Promise<Object[]>,
  fetchObjectDetail: (objectApiName) => Promise<{ fields: Field[] }>
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `getSuggestions(query, cursorPos)` | Main entry — returns context-aware suggestions |
| `_getObjectSuggestions(context)` | Objects for FROM clause (50 without search, 20 with) |
| `_getFieldSuggestions(context)` | Fields for selected object (30 without filter, 20 with) |
| `_getRelationshipFieldSuggestions(context)` | Traverse relationship path, resolve target object fields |
| `_getKeywordSuggestions(context)` | Context-aware SOQL keywords |
| `clearCache()` | Clear schema cache |

**Internal caching:** `SchemaCache` class caches objects + fields per object + relationship resolution

**Relevance scoring (0-300):**
- 300 = exact match
- 200+ = prefix match
- 80+ = contains match
- Boosted: common fields (Id, Name, CreatedDate, etc.), required fields, name fields

**Suggestion result format:**
```javascript
{
  type: "object" | "field" | "keyword",
  token: "current_word",
  suggestions: [{
    label, value, type, icon, isCustom,
    isRelationship, relationshipName, referenceTo, fullPath
  }],
  objectName,
  relationshipPath,
  isRelationshipTraversal
}
```

### 7.3 Syntax Highlighter (soqlHighlighter.js)

**Function:** `highlightSOQL(code)` → HTML string with `<span>` colorization

**Highlighting order:**
1. `escapeHtml(code)` — escape all HTML entities first (XSS prevention)
2. Keywords → `.soql-keyword` (SELECT, FROM, WHERE, AND, OR, NOT, IN, LIKE, ORDER BY, GROUP BY, HAVING, LIMIT, OFFSET, ASC, DESC, NULLS FIRST/LAST, WITH SECURITY_ENFORCED, TYPEOF, WHEN, THEN, ELSE, END, FOR VIEW/REFERENCE/UPDATE, USING SCOPE, INCLUDES, EXCLUDES, TRUE, FALSE, NULL, date literals)
3. Functions → `.soql-function` (COUNT, SUM, AVG, MIN, MAX, COUNT_DISTINCT, CALENDAR_*, DAY_*, FISCAL_*, HOUR_*, WEEK_*, FORMAT, TOLABEL, CONVERTCURRENCY, GROUPING, DISTANCE, GEOLOCATION)
4. Strings → `.soql-string` (single-quoted values)
5. Relationships → `.soql-relationship` (dot-separated identifiers)

### 7.4 Field Chips System

**Behavior:**
1. User types `FROM Account` → system detects object change
2. Fetches field list via `SOQLExplorerController.getFields()`
3. Displays up to 8 clickable chips with field type badges
4. Chips show "+N more" if >8 fields match
5. Clicking a chip inserts the field into SELECT clause
6. Handles `SELECT *` replacement and comma-appending for multiple fields

**Field type icons (Unicode):**
```
🔗 REFERENCE  |  Aa STRING     |  📝 TEXTAREA   |  📅 DATE
🕐 DATETIME   |  ✓ BOOLEAN     |  💰 CURRENCY   |  # INTEGER/DOUBLE
✉ EMAIL       |  📞 PHONE      |  🔗 URL        |  ☰ PICKLIST
🔑 ID
```

### 7.5 Query History (historyManager.js)

```javascript
{
  storageKey: "abn_devtools_soql_history",  // Change from connectry_
  maxItems: 20,
  entry: {
    query: String,
    rowCount: Number,
    executionTime: Number,  // ms
    id: String,             // timestamp-based
    timestamp: ISO String
  }
}
```

**Functions:** `getHistory()`, `saveToHistory()`, `clearHistory()`, `getRelativeTime()`

### 7.6 Export System (csvExporter.js)

| Format | Function | Output |
|--------|----------|--------|
| CSV | `buildCSVContent(columns, rows)` | UTF-8 BOM + header + data rows |
| JSON | `buildJSONContent(columns, rows)` | Pretty-printed JSON array |
| Excel | `buildExcelContent(columns, rows)` | Excel 2003 XML Spreadsheet |

**Download method:** Server-side ContentVersion creation → Salesforce download URL (bypasses iframe sandbox)

### 7.7 UI Components

```
┌─ Module Header ────────────────────────────────────────────┐
│ SOQL Explorer  [Saved Query Chips...]                       │
├─ Code Editor ──────────────────────────────────────────────┤
│ ┌─ Syntax Highlight Overlay ─────────────────────────────┐ │
│ │ SELECT Id, Name FROM Account WHERE ...                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Autocomplete Dropdown ────────────────────────────────┐ │
│ │ ☰ Objects: Account, Contact, Opportunity...            │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Field Chips ──────────────────────────────────────────┐ │
│ │ Available Fields: [Id 🔑] [Name Aa] [Email ✉] +42     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─ Action Bar ───────────────────────────────────────────────┤
│ [Execute] [Plan] [Chart] [Export ▾] [Library]              │
├─ Results ──────────────────────────────────────────────────┤
│ 47 records returned  [Save Edits] [Delete Selected]        │
│ ┌─ lightning-datatable ──────────────────────────────────┐ │
│ │ ☐ │ # │ Id          │ Name      │ Email    │ ⋮ │      │ │
│ │ ☐ │ 1 │ 001xxx...   │ Acme Corp │ ...      │ ⋮ │      │ │
│ └─────────────────────────────────────────────────────────┘ │
├─ Query Tabs ───────────────────────────────────────────────┤
│ [Account ×] [Contact ×] [+]                                │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Record Inspector — Detailed Feature Specification

### 8.1 Core Features

| Feature                | Description                                                    |
|------------------------|----------------------------------------------------------------|
| Record lookup          | Enter any record ID to inspect all fields and metadata         |
| Field display          | Table with Label, API Name, Type (badge), Description, Value   |
| Field filtering        | Search + type filter (All/Standard/Custom/Updateable/Formula/Required) |
| Populated toggle       | Show only fields with values                                   |
| Inline editing         | Edit mode for updateable fields (text, picklist, boolean, date)|
| Single/bulk delete     | Delete record with child relationship warning                  |
| Related lists          | Browse child relationships, navigate to related SOQL           |
| Field history          | Audit trail of field changes with old/new values               |
| Copy to SOQL           | Generate SELECT query for visible fields                       |
| Open in Salesforce     | Direct link to standard record page                            |

### 8.2 UI Layout

```
┌─ Record Inspector ─────────────────────────────────────────┐
│ Record ID: [________________] [Inspect] [Clear]             │
├─ Record Header ────────────────────────────────────────────┤
│ Account: Acme Corporation                                   │
│ ID: 001xxxxx [Copy] [Open in SF]                            │
│ Created: 2024-01-15 by Admin  |  Modified: 2024-03-20      │
│ [Copy SOQL] [Edit] [Delete] [Refresh]                       │
│ [Fields] [Related Lists] [History]  ← view toggle           │
├─ Filters ──────────────────────────────────────────────────┤
│ Search: [________] Filter: [All Fields ▾] ☐ Populated only  │
├─ Field Table ──────────────────────────────────────────────┤
│ Label          │ API Name      │ Type     │ Description │ Value     │
│ Account Name   │ Name          │ STRING   │ ...         │ Acme Corp │
│ Annual Revenue │ AnnualRevenue │ CURRENCY │ ...         │ $1.2M     │
│ ...            │               │          │             │           │
└────────────────────────────────────────────────────────────┘
```

---

## 9. Apex Runner — Detailed Feature Specification

### 9.1 Core Features

| Feature              | Description                                                  |
|----------------------|--------------------------------------------------------------|
| Code editor          | Large textarea for anonymous Apex with Ctrl+Enter execution  |
| Snippet library      | Pre-defined code snippets (insert at cursor)                 |
| Execution            | Tooling API executeAnonymous via self-org callout            |
| Debug output         | Parsed USER_DEBUG lines from execution log                   |
| Error display        | Compile errors with line/column, runtime exceptions + stack  |
| Debug log history    | Recent execution logs with status, duration, clickable       |
| Trace flag setup     | Auto-creates/updates debug trace flag for current user       |

### 9.2 Snippet Examples to Include

```javascript
const APEX_SNIPPETS = [
  { label: 'Debug Log', code: 'System.debug(\'Hello World\');' },
  { label: 'Query Accounts', code: 'List<Account> accs = [SELECT Id, Name FROM Account LIMIT 10];\nfor (Account a : accs) {\n    System.debug(a.Name);\n}' },
  { label: 'DML Insert', code: 'Account a = new Account(Name = \'Test Account\');\ninsert a;\nSystem.debug(\'Created: \' + a.Id);' },
  { label: 'Describe Object', code: 'Schema.DescribeSObjectResult describe = Account.SObjectType.getDescribe();\nSystem.debug(\'Fields: \' + describe.fields.getMap().keySet());' },
  { label: 'HTTP Callout', code: 'HttpRequest req = new HttpRequest();\nreq.setEndpoint(\'https://api.example.com/data\');\nreq.setMethod(\'GET\');\nHttp http = new Http();\nHttpResponse res = http.send(req);\nSystem.debug(res.getBody());' },
  { label: 'Governor Limits', code: 'System.debug(\'Queries: \' + Limits.getQueries() + \'/\' + Limits.getLimitQueries());\nSystem.debug(\'DML: \' + Limits.getDmlStatements() + \'/\' + Limits.getLimitDmlStatements());\nSystem.debug(\'Heap: \' + Limits.getHeapSize() + \'/\' + Limits.getLimitHeapSize());' }
];
```

### 9.3 UI Layout

```
┌─ Apex Runner ──────────────────────────────────────────────┐
│ [Debug Log] [Query Accounts] [DML Insert] [Describe] [Clear]│
├─ Code Editor ──────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ System.debug('Hello World');                            │ │
│ │ List<Account> accs = [SELECT Id FROM Account LIMIT 5]; │ │
│ │ System.debug(accs.size());                              │ │
│ └────────────────────────────────────────────────────────┘ │
├─ Action Bar ───────────────────────────────────────────────┤
│ [Execute Anonymous] [Library] [Event Logs]                  │
├─ Result ───────────────────────────────────────────────────┤
│ ● Success (142ms)                                           │
│ ─── Execution Log ───                                       │
│ [DEBUG] Hello World                                         │
│ [DEBUG] 5                                                   │
├─ Execution History ────────────────────────────────────────┤
│ ● System.debug('Hello...  | Success | 142ms | 2m ago       │
│ ● List<Account> accs...   | Error   | 89ms  | 15m ago      │
└────────────────────────────────────────────────────────────┘
```

---

## 10. Data Loader — Detailed Feature Specification

### 10.1 Core Features (5-Step Wizard)

| Step | Name     | Description                                                  |
|------|----------|--------------------------------------------------------------|
| 1    | Select   | Choose operation (Insert/Update/Upsert) + target object      |
| 2    | Import   | Upload CSV, paste data, or use template                      |
| 3    | Map      | Auto-map CSV columns to Salesforce fields + manual override   |
| 4    | Execute  | Configure batch size (1-200), run DML, show progress         |
| 5    | Results  | Per-row success/failure table + CSV export                   |

### 10.2 CSV Parsing (csvParser.js)

```javascript
parseCSV(content) → { headers: String[], rows: String[][] }
autoMapFields(csvHeaders, sfFields) → mappings with confidence scores
```

**Auto-mapping confidence:**
- **High** — Exact match (case-insensitive) between CSV header and field API name/label
- **Medium** — Fuzzy match (contains, similar)
- **Low** — Partial match
- **Unknown** — No match found

### 10.3 Supported Type Casting

| Apex Type    | Cast Method                     |
|--------------|---------------------------------|
| STRING       | Direct assignment               |
| INTEGER      | Integer.valueOf()               |
| DOUBLE       | Double.valueOf()                |
| CURRENCY     | Double.valueOf()                |
| PERCENT      | Double.valueOf()                |
| BOOLEAN      | Boolean.valueOf()               |
| DATE         | Date.valueOf()                  |
| DATETIME     | Datetime.valueOf()              |
| REFERENCE    | Direct assignment (18-char ID)  |
| EMAIL        | Direct assignment               |
| URL          | Direct assignment               |
| PHONE        | Direct assignment               |

### 10.4 UI Layout (Step 4 — Execute)

```
┌─ Data Loader ──────────────────────────────────────────────┐
│ ● Step 1   ● Step 2   ● Step 3   ●◉ Step 4   ○ Step 5    │
├────────────────────────────────────────────────────────────┤
│ Configure & Execute                                         │
│                                                             │
│ Batch Size: [200 ▾]                                         │
│                                                             │
│ 500 records to INSERT into Account in 3 batches             │
│                                                             │
│ ┌─ Progress ───────────────────────────────────────────┐   │
│ │ Processing batch 2 of 3...                            │   │
│ │ ████████████████████░░░░░░░░░░  67%                   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ [Cancel]                                        [Back]      │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Onboarding Flow Specification

### 11.1 Scope: 4 Tools Only

Reduce from Connectry's 9 module tours to **4 tour slides** + intro + terms:

| Step | Module ID         | Label            | Features to Highlight                       |
|------|-------------------|------------------|---------------------------------------------|
| 0    | (intro)           | Welcome          | Value proposition, hero mosaic (4 cards)     |
| 1    | recordInspector   | Record Inspector | Field view, inline editing, related lists    |
| 2    | soqlExplorer      | SOQL Explorer    | Autocomplete, chips, history, export         |
| 3    | apexRunner        | Apex Runner      | Code execution, debug logs, snippets         |
| 4    | dataLoader        | Data Loader      | CSV import, field mapping, batch execution   |
| 5    | (terms)           | Terms            | Acceptance flow (if needed, or skip)         |

### 11.2 localStorage Keys

```
abn_devtools_onboarding_complete   (boolean flag)
abn_devtools_preferences           (JSON preferences object)
abn_devtools_soql_history          (JSON array)
abn_devtools_saved_queries         (JSON array)
```

### 11.3 Onboarding State Variables

```javascript
_showWelcome = false;
_welcomeStep = 0;        // 0=intro, 1-4=tool tours, 5=terms
_welcomeAccepted = false;
_tourHighlight = null;
```

---

## 12. Visualforce Session Bridge

### 12.1 Page Source

```html
<apex:page contentType="text/plain">{!$Api.Session_ID}</apex:page>
```

**File:** `force-app/main/default/pages/DevToolsSessionId.page`

### 12.2 Page Metadata

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>65.0</apiVersion>
  <availableInTouch>false</availableInTouch>
  <confirmationTokenRequired>true</confirmationTokenRequired>
  <label>DevToolsSessionId</label>
</ApexPage>
```

---

## 13. LWC Component Metadata

### 13.1 devTools.js-meta.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>65.0</apiVersion>
  <isExposed>true</isExposed>
  <targets>
    <target>lightning__UtilityBar</target>
  </targets>
  <masterLabel>ABN Developer Tools</masterLabel>
  <description>Salesforce developer tools utility bar for ABN AMRO</description>
</LightningComponentBundle>
```

### 13.2 Utility Bar Configuration

| Property   | Value              |
|------------|--------------------|
| height     | 1200               |
| width      | 850                |
| icon       | utility:setup      |
| label      | Developer Tools    |
| eager      | false (lazy-load)  |
| scrollable | true               |

---

## 14. Naming Convention Reference

| Connectry Original              | ABN AMRO Equivalent              |
|---------------------------------|----------------------------------|
| `Connectry`                     | (no namespace)                   |
| `connectry_`                    | `abn_devtools_`                  |
| `--connectry-`                  | `--abn-`                         |
| `Command Center`                | `Developer Tools`                |
| `CommandCenterAccessController` | `DevToolsAccessController`       |
| `ConnectrySessionId`            | `DevToolsSessionId`              |
| `Command_Center_Access`         | `Dev_Tools_Access`               |
| `Connectry_Power_Tools`         | `Dev_Tools_Power`                |
| `Connectry_Admin`               | `ABN_Dev_Tools_Admin`            |
| `commandCenter` (LWC)           | `devTools` (LWC)                 |
| `Connectry_AI_Settings__c`      | (not needed — no AI)             |
| `AnthropicAPI` (remote site)    | (not needed — no AI)             |
| `.connectry-*` (CSS classes)    | `.abn-*` (CSS classes)           |

---

## 15. What to Strip (AI-Related Code)

When adapting from Connectry source, remove these entirely:

### 15.1 JavaScript
- `aiAssistant.js` — entire file
- All `handleApexAI*` methods in main controller
- All `handleDLAI*` methods (Data Loader AI generation)
- All `handleToggleApexAIPanel()` / `handleToggleSoqlAIPanel()`
- AI panel HTML sections in template
- `aiProvider`, `aiModel`, `aiPromptOverrides` from preferences
- "Generate with AI" buttons in SOQL Explorer and Apex Runner action bars

### 15.2 Apex
- `AIAssistantController.cls` — entire file
- `AIAssistantControllerTest.cls` — entire file

### 15.3 Metadata
- `Connectry_AI_Settings__c` custom setting + `API_Key__c` field
- `AnthropicAPI` remote site setting

### 15.4 HTML Template
- Remove all `template if:true={showAIPanel}` sections
- Remove "Generate with AI" buttons
- Remove AI mode buttons (Generate/Explain/Optimize)
- Remove AI prompt textareas and output sections
- Remove API key requirement messages

---

## 16. Quick-Start Checklist

```
[ ] 1. Create SFDX project: sf project generate -n abn-amro-dev-tools
[ ] 2. Copy sfdx-project.json config (Section 1.1)
[ ] 3. Create custom permissions (Section 5.1)
[ ] 4. Create permission set (Section 5.2)
[ ] 5. Create VF page + metadata (Section 12)
[ ] 6. Copy & adapt SecurityUtil.cls (change permission name)
[ ] 7. Create DevToolsAccessController.cls (Section 6.2)
[ ] 8. Copy & adapt SelfOrgCalloutHelper.cls (change VF page name)
[ ] 9. Copy SOQLExplorerController.cls as-is
[ ] 10. Copy RecordInspectorController.cls as-is
[ ] 11. Copy ApexRunnerController.cls as-is
[ ] 12. Copy DataLoaderController.cls as-is
[ ] 13. Copy all test classes (adapt permission set names)
[ ] 14. Create LWC devTools component with:
        - devTools.js (main controller, stripped of AI + excluded tools)
        - devTools.html (4-tool template only)
        - devTools.css (ABN AMRO design tokens)
        - devTools.js-meta.xml (Section 13.1)
        - soqlAutocomplete.js (as-is)
        - soqlHighlighter.js (as-is)
        - soqlTokenizer.js (as-is)
        - csvExporter.js (as-is)
        - csvParser.js (as-is)
        - historyManager.js (change storage keys)
        - preferencesManager.js (change storage keys, remove AI prefs)
        - devToolsConstants.js (4 modules only, ABN colors)
[ ] 15. Create flexipage for utility bar
[ ] 16. Create custom application
[ ] 17. Create onboarding flow (4 slides)
[ ] 18. Create unlocked package: sf package create -n ABN-AMRO-Developer-Tools -t Unlocked
[ ] 19. Create package version: sf package version create -p ABN-AMRO-Developer-Tools -w 30
[ ] 20. Deploy to target org and assign permission set
```

---

## 17. Testing Strategy

### 17.1 Test Classes Required (7 total)

| Production Class            | Test Class                       |
|-----------------------------|----------------------------------|
| SecurityUtil                | SecurityUtilTest                 |
| DevToolsAccessController    | DevToolsAccessControllerTest     |
| SelfOrgCalloutHelper        | SelfOrgCalloutHelperTest         |
| SOQLExplorerController      | SOQLExplorerControllerTest       |
| RecordInspectorController   | RecordInspectorControllerTest    |
| ApexRunnerController        | ApexRunnerControllerTest         |
| DataLoaderController        | DataLoaderControllerTest         |

### 17.2 Test Patterns

- `@IsTest` on all test classes and methods
- `System.runAs()` for user context isolation
- Permission set assignment in test setup (`ABN_Dev_Tools_Admin`)
- `SecurityUtil.testPermissionOverride = false` for denied-path testing
- `HttpCalloutMock` for all callout-dependent tests
- No `SeeAllData=true`
- Self-contained mock data in every test

---

*Generated 2026-02-23 — ABN AMRO Developer Tools Project Manifest v1.0*
