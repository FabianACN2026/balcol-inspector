/**
 * ABN AMRO Developer Tools — CSV/JSON/Excel Exporter
 * Builds export file content from query result columns and rows.
 */

const BOM = '\uFEFF';

export function buildCSVContent(columns, rows) {
    const header = columns.map(col => escapeCSVField(col.label || col.fieldName)).join(',');
    const dataRows = rows.map(row =>
        columns.map(col => {
            const value = row[col.fieldName];
            return escapeCSVField(value != null ? String(value) : '');
        }).join(',')
    );
    return BOM + header + '\n' + dataRows.join('\n');
}

export function buildJSONContent(columns, rows) {
    const data = rows.map(row => {
        const obj = {};
        columns.forEach(col => {
            obj[col.fieldName] = row[col.fieldName] != null ? row[col.fieldName] : null;
        });
        return obj;
    });
    return JSON.stringify(data, null, 2);
}

export function buildExcelContent(columns, rows) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '  <Styles>\n';
    xml += '    <Style ss:ID="header">\n';
    xml += '      <Font ss:Bold="1" ss:Color="#FFFFFF"/>\n';
    xml += '      <Interior ss:Color="#00453A" ss:Pattern="Solid"/>\n';
    xml += '    </Style>\n';
    xml += '    <Style ss:ID="date"><NumberFormat ss:Format="yyyy-mm-dd"/></Style>\n';
    xml += '    <Style ss:ID="datetime"><NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/></Style>\n';
    xml += '  </Styles>\n';
    xml += '  <Worksheet ss:Name="Query Results">\n';
    xml += `    <Table ss:ExpandedColumnCount="${columns.length}" ss:ExpandedRowCount="${rows.length + 1}">\n`;

    // Header row
    xml += '      <Row ss:StyleID="header">\n';
    columns.forEach(col => {
        xml += `        <Cell><Data ss:Type="String">${escapeXml(col.label || col.fieldName)}</Data></Cell>\n`;
    });
    xml += '      </Row>\n';

    // Data rows
    rows.forEach(row => {
        xml += '      <Row>\n';
        columns.forEach(col => {
            const value = row[col.fieldName];
            const cellType = getCellType(col.type, value);
            const styleAttr = getStyleAttr(col.type);
            const displayValue = value != null ? String(value) : '';
            xml += `        <Cell${styleAttr}><Data ss:Type="${cellType}">${escapeXml(displayValue)}</Data></Cell>\n`;
        });
        xml += '      </Row>\n';
    });

    xml += '    </Table>\n';
    xml += '  </Worksheet>\n';
    xml += '</Workbook>';
    return xml;
}

function escapeCSVField(value) {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function escapeXml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function getCellType(fieldType, value) {
    if (value == null || value === '') return 'String';
    const type = (fieldType || '').toUpperCase();
    if (['INTEGER', 'DOUBLE', 'CURRENCY', 'PERCENT', 'LONG'].includes(type)) {
        return 'Number';
    }
    if (['DATE', 'DATETIME'].includes(type)) {
        return 'DateTime';
    }
    if (type === 'BOOLEAN') {
        return 'Boolean';
    }
    return 'String';
}

function getStyleAttr(fieldType) {
    const type = (fieldType || '').toUpperCase();
    if (type === 'DATE') return ' ss:StyleID="date"';
    if (type === 'DATETIME') return ' ss:StyleID="datetime"';
    return '';
}
