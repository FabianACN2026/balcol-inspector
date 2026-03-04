/**
 * ABN AMRO Developer Tools — CSV Parser
 * Parses CSV file content and provides auto-mapping for Data Loader.
 */

export function parseCSV(content) {
    if (!content) return { headers: [], rows: [] };

    // Remove BOM if present
    let text = content;
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
    }

    const lines = splitLines(text);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            rows.push(parseLine(lines[i]));
        }
    }

    return { headers, rows };
}

function splitLines(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
                current += char;
            }
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                i++;
            }
            lines.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) {
        lines.push(current);
    }
    return lines;
}

function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
}

export function autoMapFields(csvHeaders, sfFields) {
    const mappings = [];
    const sfFieldMap = new Map();
    const sfLabelMap = new Map();

    sfFields.forEach(f => {
        sfFieldMap.set((f.apiName || '').toLowerCase(), f);
        sfLabelMap.set((f.label || '').toLowerCase(), f);
    });

    csvHeaders.forEach((header, index) => {
        const headerLower = (header || '').toLowerCase().trim();
        const headerNormalized = headerLower.replace(/[\s_-]+/g, '');
        let match = null;
        let confidence = 'unknown';

        // Exact match on API name
        if (sfFieldMap.has(headerLower)) {
            match = sfFieldMap.get(headerLower);
            confidence = 'high';
        }
        // Exact match on label
        else if (sfLabelMap.has(headerLower)) {
            match = sfLabelMap.get(headerLower);
            confidence = 'high';
        }
        // Normalized match
        else {
            for (const [, field] of sfFieldMap) {
                const apiNorm = (field.apiName || '').toLowerCase().replace(/[\s_-]+/g, '');
                const labelNorm = (field.label || '').toLowerCase().replace(/[\s_-]+/g, '');
                if (apiNorm === headerNormalized || labelNorm === headerNormalized) {
                    match = field;
                    confidence = 'medium';
                    break;
                }
            }
        }

        // Contains match
        if (!match) {
            for (const [, field] of sfFieldMap) {
                const apiLower = (field.apiName || '').toLowerCase();
                const labelLower = (field.label || '').toLowerCase();
                if (apiLower.includes(headerLower) || headerLower.includes(apiLower) ||
                    labelLower.includes(headerLower) || headerLower.includes(labelLower)) {
                    match = field;
                    confidence = 'low';
                    break;
                }
            }
        }

        mappings.push({
            csvIndex: index,
            csvHeader: header,
            sfField: match ? match.apiName : null,
            sfFieldLabel: match ? match.label : null,
            sfFieldType: match ? match.type : null,
            confidence,
            isMatched: match != null
        });
    });

    return mappings;
}
