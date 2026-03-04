<![CDATA[<div align="center">

# BALCOL Inspector

### ABN AMRO Developer Tools for Salesforce

A Salesforce-native developer toolkit for record inspection, SOQL exploration,
anonymous Apex execution, and bulk data operations — built for speed and security.

[![Salesforce](https://img.shields.io/badge/Salesforce-Lightning-00A1E0?logo=salesforce&logoColor=white)](https://www.salesforce.com)
[![API Version](https://img.shields.io/badge/API%20Version-65.0-blue)](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta)
[![License](https://img.shields.io/badge/License-Internal-lightgrey)]()

</div>

---

## Overview

**BALCOL Inspector** is a single Lightning Web Component (LWC) application that provides four powerful developer tools inside Salesforce — no external dependencies, no installation overhead. It runs natively on the Salesforce platform using only standard APIs, and is secured via custom permissions.

| Tool | Description |
|---|---|
| **Record Inspector** | Browse any record's fields, metadata, types, and values. Edit inline. Navigate related records and child relationships. Multi-tab support. |
| **SOQL Explorer** | Write and execute SOQL with syntax highlighting, autocomplete (fields, relationships up to 4 levels), cursor-based pagination, and inline record editing. |
| **Apex Runner** | Execute anonymous Apex with syntax-highlighted output, debug log parsing, and DML safety warnings. |
| **Data Loader** | Bulk insert, update, upsert, and delete records via CSV. Field mapping UI, batch processing, and detailed result reporting. |

<div align="center">
<img src="docs/assets/hero-screenshot.png" alt="BALCOL Inspector — Record Inspector" width="700">
</div>

---

## Features

- **Zero Installation** — Deploy via Salesforce DX; no npm packages, no external services
- **Single LWC Architecture** — One component, 12+ files, 8 Apex controllers
- **Dark Theme** — ABN AMRO-branded dark UI with CSS custom properties (`--abn-*`)
- **Cursor-Based Pagination** — No 2000-row OFFSET limit; streams results via REST API
- **SOQL Autocomplete** — Schema-aware field suggestions with relationship traversal (up to 4 levels)
- **SOQL Syntax Highlighting** — Real-time tokenizer with overlay textarea pattern
- **Inline Record Editing** — Edit field values directly in Record Inspector and SOQL results
- **Batch Data Operations** — CSV import/export with field mapping and progress tracking
- **Progressive Loading** — Auto-streaming query results in 200-record batches
- **Security** — Custom permissions (`Dev_Tools_Access`, `Dev_Tools_Power`) gate all functionality
- **Caching** — Client-side schema cache, server-side describe caching, localStorage preferences

---

## Project Structure

```
force-app/main/default/
├── classes/
│   ├── RecordInspectorController.cls      # Record field/metadata operations
│   ├── SOQLExplorerController.cls         # SOQL execution & schema describe
│   ├── ApexRunnerController.cls           # Anonymous Apex execution & debug logs
│   ├── DataLoaderController.cls           # Bulk DML operations (insert/update/upsert/delete)
│   ├── MetadataBrowserController.cls      # EntityDefinition-based object listing
│   ├── SecurityUtil.cls                   # Permission checks & security enforcement
│   ├── SelfOrgCalloutHelper.cls           # REST API callouts for cursor pagination
│   ├── DevToolsAccessController.cls       # Access verification
│   └── *_Test.cls                         # Corresponding test classes
└── lwc/devTools/
    ├── devTools.js                         # Main controller (~2200 lines)
    ├── devTools.html                       # Template (~988 lines)
    ├── devTools.css                        # ABN AMRO dark theme (~1700 lines)
    ├── devTools.js-meta.xml               # Component metadata
    ├── devToolsConstants.js               # Shared constants
    ├── soqlTokenizer.js                   # SOQL tokenizer with clause context
    ├── soqlAutocomplete.js                # Schema-aware autocomplete engine
    ├── soqlHighlighter.js                 # Syntax highlighting renderer
    ├── historyManager.js                  # Query/Apex history (localStorage)
    ├── preferencesManager.js              # User preferences (localStorage)
    ├── csvParser.js                       # CSV parsing for Data Loader
    └── csvExporter.js                     # CSV export for query results

docs/
├── technical-documentation.html           # Full technical documentation
├── onboarding.html                        # Interactive onboarding guide
├── quick-start-guide.html                 # Getting started guide
└── assets/                                # Screenshots and images
```

---

## Prerequisites

- **Salesforce CLI** (`sf`) — [Install Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm)
- **Salesforce Org** — Developer Edition, Sandbox, or Scratch Org
- **Custom Permissions** created in the target org:
  - `Dev_Tools_Access` — Required for all users
  - `Dev_Tools_Power` — Required for Apex Runner and Data Loader

---

## Deployment

### Deploy to a Sandbox or Production Org

```bash
# Authenticate to your org
sf org login web --alias myorg

# Deploy the source
sf project deploy start \
  --source-dir force-app/main/default/classes \
  --source-dir force-app/main/default/lwc/devTools \
  --target-org myorg \
  --wait 10
```

### Deploy to a Scratch Org

```bash
# Create a scratch org
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-dev --duration-days 30

# Push source
sf project deploy start --target-org scratch-dev

# Assign permissions
sf org assign permset --name Dev_Tools_Access --target-org scratch-dev
```

### Post-Deployment Setup

1. **Create Custom Permissions** — `Dev_Tools_Access` and `Dev_Tools_Power` in Setup > Custom Permissions
2. **Assign Permissions** — Add the custom permissions to the appropriate Permission Sets
3. **Add to Lightning Page** — Drag the `devTools` component onto any Lightning App Page, Record Page, or App Builder page
4. **Remote Site Setting** — Add your org's My Domain URL as a Remote Site for cursor-based pagination (used by `SelfOrgCalloutHelper`)

---

## Configuration

### Custom Permissions

| Permission | Required For | Description |
|---|---|---|
| `Dev_Tools_Access` | All tools | Base access to BALCOL Inspector |
| `Dev_Tools_Power` | Apex Runner, Data Loader | Elevated access for code execution and bulk DML |

### localStorage Keys

All client-side preferences are stored with the `abn_devtools_` prefix:

| Key | Purpose |
|---|---|
| `abn_devtools_prefs` | UI preferences (theme, default tab, etc.) |
| `abn_devtools_query_history` | SOQL query history |
| `abn_devtools_apex_history` | Apex execution history |

---

## Architecture

### Client-Side (LWC)

The entire UI is a single Lightning Web Component (`devTools`) using:

- **Overlay Textarea Pattern** — Transparent `<textarea>` over syntax-highlighted `<pre><code>` for SOQL editing
- **Schema Cache** — Client-side caching of object/field describes with pending fetch deduplication
- **Monotonic Request IDs** — Stale closure guard for debounced autocomplete (50ms)
- **Spread Operator Reactivity** — All array/object mutations use spread for LWC reactive tracking
- **CSS Custom Properties** — Full theming via `--abn-*` variables

### Server-Side (Apex)

Eight Apex controllers handle all server operations:

- All methods are `@AuraEnabled(cacheable=true)` where possible
- Security checks via `SecurityUtil` on every operation
- `SelfOrgCalloutHelper` enables REST API callouts to the same org for cursor-based SOQL pagination
- `Pattern.compile` moved to static constants for performance
- Child relationship queries capped with `LIMIT 1` for existence checks

---

## Running Tests

```bash
# Run all test classes
sf apex run test \
  --target-org myorg \
  --test-level RunSpecifiedTests \
  --tests ApexRunnerController_Test \
  --tests DataLoaderController_Test \
  --tests RecordInspectorController_Test \
  --tests SOQLExplorerController_Test \
  --tests MetadataBrowserController_Test \
  --tests SecurityUtil_Test \
  --tests SelfOrgCalloutHelper_Test \
  --tests DevToolsAccessController_Test \
  --wait 10 \
  --result-format human
```

---

## Documentation

| Document | Description |
|---|---|
| [Technical Documentation](docs/technical-documentation.html) | Full architecture, API reference, and implementation details |
| [Quick Start Guide](docs/quick-start-guide.html) | Step-by-step deployment and setup guide |
| [Onboarding](docs/onboarding.html) | Interactive visual guide for new users |

---

## Tech Stack

- **Lightning Web Components** (LWC) — UI framework
- **Apex** — Server-side controllers
- **Salesforce REST API** — Cursor-based pagination via `SelfOrgCalloutHelper`
- **Salesforce API v65.0** — Platform API version
- **CSS Custom Properties** — Themeable dark UI
- **localStorage** — Client-side preferences and history

---

## Contributing

This is an internal ABN AMRO project. For questions, feature requests, or bug reports, please reach out to the development team.

---

<div align="center">

**ABN AMRO** — BALCOL Inspector v1.0

</div>
]]>