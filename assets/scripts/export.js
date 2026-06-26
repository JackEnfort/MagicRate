// export.js

function exportDataToCSV() {
    const container = document.getElementById('swal2-content');
    if (!container) {
        alert("Please analyse data before exporting!");
        return;
    }

    let csvLines = [];
    
    // 1. Setup a structured map to collect the top summary metrics
    const summarySections = ["Star rating", "Cooling", "Heating"];
    let currentSection = "";
    let summaryData = {};

    // Initialize the structure for each expected category
    summarySections.forEach(sec => {
        summaryData[sec] = { estimate: "", pi: "", model: "" };
    });

    // 2. Parse the summary blocks dynamically from the DOM
    Array.from(container.children).forEach(child => {
        const header = child.querySelector('h2.swal2-header');
        if (header) {
            currentSection = header.innerText.trim();
            return;
        }

        // Skip the main table section for now
        if (currentSection === "Annual WoH estimates") return;

        const label = child.querySelector('label.swal2-info');
        if (label && summarySections.includes(currentSection)) {
            // Clean out trailing asterisks or footnotes
            let labelText = label.innerText.trim().replace(/\s\*$/, '').trim();

            if (labelText.includes(':')) {
                const parts = labelText.split(':');
                const key = parts[0].trim().toLowerCase();
                const val = parts.slice(1).join(':').trim();
                
                // Map values to their specific columns based on keywords
                if (key.includes('estimate')) {
                    summaryData[currentSection].estimate = val;
                } else if (key.includes('pi')) {
                    summaryData[currentSection].pi = val;
                } else if (key.includes('model')) {
                    summaryData[currentSection].model = val;
                }
            }
        }
    });

    // 3. Write the Summary Header and Rows to CSV
    csvLines.push('"Category","Estimate","90% PI","Model"'); // Column Headers
    summarySections.forEach(category => {
        const est = summaryData[category].estimate.replace(/"/g, '""');
        const pi = summaryData[category].pi.replace(/"/g, '""');
        const model = summaryData[category].model.replace(/"/g, '""');
        csvLines.push(`"${category}","${est}","${pi}","${model}"`);
    });

    // Spacing between summary cards and the main breakdown table
    csvLines.push("", "");

    // 4. Parse the "Annual WoH estimates" Data Table (Kept exactly as before)
    const table = container.querySelector('table');
    if (table) {
        const headers = Array.from(table.querySelectorAll('thead th'))
            .map(th => `"${th.innerText.trim().replace(/"/g, '""')}"`);
        csvLines.push(headers.join(','));

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const rowData = [];
            const rowHeader = row.querySelector('th');
            rowData.push(rowHeader ? `"${rowHeader.innerText.trim().replace(/"/g, '""')}"` : '""');

            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                rowData.push(`"${cell.innerText.trim().replace(/"/g, '""')}"`);
            });

            csvLines.push(rowData.join(','));
        });
    }

    // 5. Extract global footnote model rule
    const globalModel = Array.from(container.querySelectorAll('label.swal2-info'))
        .find(l => l.innerText.includes('RapidRate Whole of Home'));
    if (globalModel) {
        csvLines.push("", `"Global System Model","${globalModel.innerText.trim().replace(/"/g, '""')}"`);
    }

    // 6. Trigger File Download
    const csvString = csvLines.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `Energy_Estimates_Export_${Date.now()}.csv`);
    document.body.appendChild(downloadLink);
    
    downloadLink.click();
    document.body.removeChild(downloadLink);
}