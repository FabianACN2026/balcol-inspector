/**
 * ABN AMRO Developer Tools — SOQL Tokenizer
 * Client-side query parsing for IntelliSense.
 * Handles clause detection, relationship chain parsing, and cursor context.
 */

// SOQL Keywords
export const SOQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
    'ORDER', 'BY', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
    'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'FOR', 'UPDATE', 'VIEW', 'REFERENCE', 'ALL', 'ROWS',
    'USING', 'SCOPE', 'WITH', 'DATA', 'CATEGORY',
    'SECURITY_ENFORCED', 'TYPEOF', 'WHEN', 'THEN', 'ELSE', 'END'
];

// Aggregate Functions
export const AGGREGATE_FUNCTIONS = [
    'COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX'
];

// Date Functions
export const DATE_FUNCTIONS = [
    'CALENDAR_MONTH', 'CALENDAR_QUARTER', 'CALENDAR_YEAR',
    'DAY_IN_MONTH', 'DAY_IN_WEEK', 'DAY_IN_YEAR', 'DAY_ONLY',
    'FISCAL_MONTH', 'FISCAL_QUARTER', 'FISCAL_YEAR',
    'HOUR_IN_DAY', 'WEEK_IN_MONTH', 'WEEK_IN_YEAR'
];

// Date Literals
export const DATE_LITERALS = [
    'TODAY', 'YESTERDAY', 'TOMORROW',
    'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
    'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH',
    'LAST_90_DAYS', 'NEXT_90_DAYS',
    'LAST_N_DAYS', 'NEXT_N_DAYS', 'LAST_N_WEEKS', 'NEXT_N_WEEKS',
    'LAST_N_MONTHS', 'NEXT_N_MONTHS',
    'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER',
    'LAST_N_QUARTERS', 'NEXT_N_QUARTERS',
    'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR',
    'LAST_N_YEARS', 'NEXT_N_YEARS',
    'THIS_FISCAL_QUARTER', 'LAST_FISCAL_QUARTER', 'NEXT_FISCAL_QUARTER',
    'THIS_FISCAL_YEAR', 'LAST_FISCAL_YEAR', 'NEXT_FISCAL_YEAR'
];

// Operators
export const OPERATORS = [
    '=', '!=', '<>', '<', '>', '<=', '>=',
    'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES'
];

// FIELDS() functions
export const FIELDS_FUNCTIONS = [
    'FIELDS(ALL)', 'FIELDS(STANDARD)', 'FIELDS(CUSTOM)'
];

// Token types
export const TokenType = {
    KEYWORD: 'keyword',
    IDENTIFIER: 'identifier',
    OPERATOR: 'operator',
    STRING: 'string',
    NUMBER: 'number',
    COMMA: 'comma',
    DOT: 'dot',
    PAREN_OPEN: 'paren_open',
    PAREN_CLOSE: 'paren_close',
    WHITESPACE: 'whitespace',
    UNKNOWN: 'unknown'
};

// All keywords for token classification
const ALL_KEYWORDS_SET = new Set([
    ...SOQL_KEYWORDS, ...AGGREGATE_FUNCTIONS, ...DATE_FUNCTIONS
]);

/**
 * Tokenize a SOQL query into tokens.
 */
export function tokenize(query) {
    const tokens = [];
    let pos = 0;

    while (pos < query.length) {
        const char = query[pos];

        // Whitespace
        if (/\s/.test(char)) {
            const start = pos;
            while (pos < query.length && /\s/.test(query[pos])) { pos++; }
            tokens.push({ type: TokenType.WHITESPACE, value: query.substring(start, pos), start, end: pos });
            continue;
        }

        // String literal (single quotes)
        if (char === "'") {
            const start = pos;
            pos++;
            while (pos < query.length && query[pos] !== "'") {
                if (query[pos] === '\\' && pos + 1 < query.length) { pos += 2; }
                else { pos++; }
            }
            if (pos < query.length) pos++;
            tokens.push({ type: TokenType.STRING, value: query.substring(start, pos), start, end: pos });
            continue;
        }

        // Number
        if (/\d/.test(char) || (char === '-' && /\d/.test(query[pos + 1] || ''))) {
            const start = pos;
            if (char === '-') pos++;
            while (pos < query.length && /[\d.]/.test(query[pos])) { pos++; }
            tokens.push({ type: TokenType.NUMBER, value: query.substring(start, pos), start, end: pos });
            continue;
        }

        // Multi-char operators
        if (query.substring(pos, pos + 2) === '!=' || query.substring(pos, pos + 2) === '<>') {
            tokens.push({ type: TokenType.OPERATOR, value: query.substring(pos, pos + 2), start: pos, end: pos + 2 });
            pos += 2;
            continue;
        }
        if (query.substring(pos, pos + 2) === '<=' || query.substring(pos, pos + 2) === '>=') {
            tokens.push({ type: TokenType.OPERATOR, value: query.substring(pos, pos + 2), start: pos, end: pos + 2 });
            pos += 2;
            continue;
        }
        if (/[=<>]/.test(char)) {
            tokens.push({ type: TokenType.OPERATOR, value: char, start: pos, end: pos + 1 });
            pos++;
            continue;
        }

        // Comma
        if (char === ',') {
            tokens.push({ type: TokenType.COMMA, value: char, start: pos, end: pos + 1 });
            pos++;
            continue;
        }

        // Dot
        if (char === '.') {
            tokens.push({ type: TokenType.DOT, value: char, start: pos, end: pos + 1 });
            pos++;
            continue;
        }

        // Parentheses
        if (char === '(') {
            tokens.push({ type: TokenType.PAREN_OPEN, value: char, start: pos, end: pos + 1 });
            pos++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: TokenType.PAREN_CLOSE, value: char, start: pos, end: pos + 1 });
            pos++;
            continue;
        }

        // Identifier or keyword
        if (/[a-zA-Z_]/.test(char)) {
            const start = pos;
            while (pos < query.length && /[a-zA-Z0-9_]/.test(query[pos])) { pos++; }
            const value = query.substring(start, pos);
            const isKeyword = ALL_KEYWORDS_SET.has(value.toUpperCase());
            tokens.push({
                type: isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER,
                value,
                start,
                end: pos
            });
            continue;
        }

        // Unknown character
        tokens.push({ type: TokenType.UNKNOWN, value: char, start: pos, end: pos + 1 });
        pos++;
    }

    return tokens;
}

/**
 * Parse the FROM clause object from tokens (searches entire query).
 */
function parseFromObject(tokens) {
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === TokenType.KEYWORD && token.value.toUpperCase() === 'FROM') {
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].type === TokenType.WHITESPACE) continue;
                if (tokens[j].type === TokenType.IDENTIFIER) {
                    return tokens[j].value;
                }
                break;
            }
        }
    }
    return null;
}

/**
 * Determine which clause the cursor is in.
 */
function determineClause(tokens, cursorPosition) {
    const clauses = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type !== TokenType.KEYWORD) continue;
        const upper = token.value.toUpperCase();

        if (upper === 'ORDER' || upper === 'GROUP') {
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].type === TokenType.WHITESPACE) continue;
                if (tokens[j].type === TokenType.KEYWORD && tokens[j].value.toUpperCase() === 'BY') {
                    clauses.push({ name: upper + '_BY', start: token.start });
                }
                break;
            }
        } else if (['SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET'].includes(upper)) {
            clauses.push({ name: upper, start: token.start });
        }
    }

    clauses.sort((a, b) => a.start - b.start);

    let currentClause = 'UNKNOWN';
    for (const clause of clauses) {
        if (clause.start <= cursorPosition) {
            currentClause = clause.name;
        } else {
            break;
        }
    }

    return currentClause;
}

/**
 * Extract the word being typed at cursor position.
 */
function extractCurrentWord(query, cursorPosition) {
    const before = query.substring(0, cursorPosition);
    const after = query.substring(cursorPosition);

    let wordStart = cursorPosition;
    for (let i = before.length - 1; i >= 0; i--) {
        if (/[\s,.(]/.test(before[i])) {
            wordStart = i + 1;
            break;
        }
        if (i === 0) {
            wordStart = 0;
        }
    }

    let wordEnd = cursorPosition;
    for (let i = 0; i < after.length; i++) {
        if (/[\s,.)=<>!]/.test(after[i])) {
            wordEnd = cursorPosition + i;
            break;
        }
        wordEnd = cursorPosition + i + 1;
    }

    return {
        word: query.substring(wordStart, cursorPosition),
        start: wordStart,
        end: wordEnd
    };
}

/**
 * Extract relationship path if cursor is in a dotted expression.
 * e.g., "Account.Owner.Ma|nager" at cursor returns path=['Account','Owner'], partial='Ma'
 */
function extractRelationshipPath(query, cursorPosition) {
    const before = query.substring(0, cursorPosition);

    let exprStart = cursorPosition;
    for (let i = before.length - 1; i >= 0; i--) {
        if (/[\s,(]/.test(before[i])) {
            exprStart = i + 1;
            break;
        }
        if (i === 0) {
            exprStart = 0;
        }
    }

    const expression = before.substring(exprStart);
    const parts = expression.split('.');
    const partial = parts.pop() || '';
    const afterDot = before.endsWith('.');

    return {
        path: parts,
        partial: afterDot ? '' : partial,
        afterDot
    };
}

/**
 * Get the full context at cursor position — main entry point for suggestions.
 * @param {string} query - The SOQL query string
 * @param {number} cursorPosition - Cursor position (0-indexed)
 * @returns {Object} Context object for suggestion engine
 */
export function getClauseContext(query, cursorPosition) {
    if (!query) {
        return {
            clause: 'SELECT',
            objectName: null,
            currentWord: '',
            relationshipPath: [],
            afterDot: false,
            afterComma: false,
            expectedNext: 'field',
            wordStart: 0,
            cursorPosition: 0,
            // Backward compat
            token: '',
            isRelationship: false,
            isAfterFrom: false
        };
    }

    const tokens = tokenize(query);
    const clause = determineClause(tokens, cursorPosition);
    const objectName = parseFromObject(tokens);
    const { word: currentWord, start: wordStart } = extractCurrentWord(query, cursorPosition);
    const { path: relationshipPath, partial, afterDot } = extractRelationshipPath(query, cursorPosition);

    const beforeCursor = query.substring(0, cursorPosition).trimEnd();
    const afterComma = beforeCursor.endsWith(',');

    let expectedNext = 'field';

    switch (clause) {
        case 'SELECT':
            expectedNext = 'field';
            break;
        case 'FROM':
            expectedNext = 'object';
            break;
        case 'WHERE':
        case 'HAVING':
            expectedNext = 'field';
            break;
        case 'ORDER_BY':
        case 'GROUP_BY':
            expectedNext = 'field';
            break;
        case 'LIMIT':
        case 'OFFSET':
            expectedNext = 'none';
            break;
        default:
            expectedNext = 'keyword';
    }

    // Override: if after a dot, we're looking for a field (relationship traversal)
    if (afterDot && relationshipPath.length > 0) {
        expectedNext = 'field';
    }

    const resolvedToken = partial || currentWord;

    return {
        clause,
        objectName,
        currentWord: resolvedToken,
        relationshipPath,
        afterDot,
        afterComma,
        expectedNext,
        wordStart,
        cursorPosition,
        // Backward compat aliases
        token: resolvedToken,
        isRelationship: relationshipPath.length > 0,
        isAfterFrom: objectName !== null
    };
}

// Backward compat alias
export const getQueryContext = getClauseContext;

// Legacy exports
export const SOQL_FUNCTIONS = new Set([
    ...AGGREGATE_FUNCTIONS, ...DATE_FUNCTIONS
]);
