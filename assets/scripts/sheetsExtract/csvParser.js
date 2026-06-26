// STAGE 1: Standard RFC 4180 Parsing Matrix Engine
function parseCSVToArray(text) {
    const lines = []; let row = []; let field = ''; let insideQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i]; const next = text[i + 1];
        if (insideQuotes) {
            if (c === '"') {
                if (next === '"') { field += '"'; i++; } else { insideQuotes = false; }
            } else { field += c; }
        } else {
            if (c === '"') { insideQuotes = true; } 
            else if (c === ',') { row.push(field.trim()); field = ''; } 
            else if (c === '\r' || c === '\n') {
                row.push(field.trim());
                if (row.length > 1 || row[0] !== '') lines.push(row);
                row = []; field = '';
                if (c === '\r' && next === '\n') i++;
            } else { field += c; }
        }
    }
    if (field || row.length > 0) { row.push(field.trim()); lines.push(row); }
    return lines;
}

function createColumnResolver(headerRow) {
    const resolvedMap = {};
    const normalizedHeaders = headerRow.map(h => h.toString().toLowerCase().trim());
    for (const [key, rule] of Object.entries(COLUMN_RULES)) {
        let matchedIdx = -1;
        for (const token of rule.tokens) {
            matchedIdx = normalizedHeaders.findIndex(h => h.includes(token));
            if (matchedIdx !== -1) break;
        }
        resolvedMap[key] = (matchedIdx !== -1) ? matchedIdx : rule.fallback;
    }
    return resolvedMap;
}