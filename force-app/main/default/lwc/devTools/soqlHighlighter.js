/**
 * ABN AMRO Developer Tools — SOQL Syntax Highlighter
 * Converts SOQL text to syntax-highlighted HTML via span colorization.
 */

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const KEYWORD_PATTERN = new RegExp(
    '\\b(' +
    'SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|' +
    'ORDER\\s+BY|GROUP\\s+BY|HAVING|LIMIT|OFFSET|' +
    'ASC|DESC|NULLS\\s+FIRST|NULLS\\s+LAST|' +
    'WITH\\s+SECURITY_ENFORCED|TYPEOF|WHEN|THEN|ELSE|END|' +
    'FOR\\s+VIEW|FOR\\s+REFERENCE|FOR\\s+UPDATE|USING\\s+SCOPE|' +
    'INCLUDES|EXCLUDES|TRUE|FALSE|NULL|' +
    'YESTERDAY|TODAY|TOMORROW|LAST_WEEK|THIS_WEEK|NEXT_WEEK|' +
    'LAST_MONTH|THIS_MONTH|NEXT_MONTH|LAST_90_DAYS|NEXT_90_DAYS|' +
    'LAST_N_DAYS|NEXT_N_DAYS|THIS_QUARTER|LAST_QUARTER|NEXT_QUARTER|' +
    'THIS_YEAR|LAST_YEAR|NEXT_YEAR|THIS_FISCAL_QUARTER|' +
    'LAST_FISCAL_QUARTER|NEXT_FISCAL_QUARTER|THIS_FISCAL_YEAR|' +
    'LAST_FISCAL_YEAR|NEXT_FISCAL_YEAR' +
    ')\\b',
    'gi'
);

const FUNCTION_PATTERN = new RegExp(
    '\\b(' +
    'COUNT|COUNT_DISTINCT|SUM|AVG|MIN|MAX|' +
    'CALENDAR_MONTH|CALENDAR_QUARTER|CALENDAR_YEAR|' +
    'DAY_IN_MONTH|DAY_IN_WEEK|DAY_IN_YEAR|DAY_ONLY|' +
    'FISCAL_MONTH|FISCAL_QUARTER|FISCAL_YEAR|' +
    'HOUR_IN_DAY|WEEK_IN_MONTH|WEEK_IN_YEAR|' +
    'FORMAT|TOLABEL|CONVERTCURRENCY|GROUPING|' +
    'DISTANCE|GEOLOCATION' +
    ')(?=\\s*\\()',
    'gi'
);

const STRING_PATTERN = /('[^']*')/g;

const NUMBER_PATTERN = /\b(\d+(?:\.\d+)?)\b/g;

const RELATIONSHIP_PATTERN = /\b(\w+(?:\.\w+)+)\b/g;

export function highlightSOQL(code) {
    if (!code) return '';

    let result = escapeHtml(code);

    // 1. Strings — extract and replace with placeholders
    const strings = [];
    result = result.replace(STRING_PATTERN, (match) => {
        const idx = strings.length;
        strings.push(match);
        return `\x00STR${idx}\x00`;
    });

    // 2. Functions (before keywords so COUNT etc. get function style)
    result = result.replace(FUNCTION_PATTERN, '<span class="soql-function">$1</span>');

    // 3. Keywords
    result = result.replace(KEYWORD_PATTERN, '<span class="soql-keyword">$1</span>');

    // 4. Relationships (dot-notation)
    result = result.replace(RELATIONSHIP_PATTERN, (match) => {
        return `<span class="soql-relationship">${match}</span>`;
    });

    // 5. Numbers
    result = result.replace(NUMBER_PATTERN, (match, num, offset, str) => {
        // Don't highlight if already inside a span tag
        const before = str.substring(Math.max(0, offset - 20), offset);
        if (before.includes('<span') && !before.includes('</span>')) return match;
        return `<span class="soql-number">${match}</span>`;
    });

    // 6. Restore strings
    strings.forEach((str, idx) => {
        result = result.replace(`\x00STR${idx}\x00`, `<span class="soql-string">${str}</span>`);
    });

    return result;
}
