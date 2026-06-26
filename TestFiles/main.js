// STAGE 4: Interface Rendering & DOM Injection Pipeline
let datasetRows = [];
let runtimeColumnMap = {};

async function initializeSystemEngine() {
    const selector = document.getElementById('address-selector');
    const fetchUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.sheetTabName)}`;
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Connection failed.");
        const text = await response.text();
        
        const matrix = parseCSVToArray(text);
        if (matrix.length < 2) return;

        runtimeColumnMap = createColumnResolver(matrix[0]);
        const addrIdx = runtimeColumnMap['address'];

        datasetRows = matrix.slice(1).filter(row => row[addrIdx]);

        selector.innerHTML = '<option value="">-- Choose target address --</option>';
        datasetRows.forEach((row, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.textContent = row[addrIdx];
            selector.appendChild(opt);
        });

        document.getElementById('btn-analyse').disabled = false;
    } catch (err) {
        console.error(err);
        selector.innerHTML = '<option value="">Error loading sheet values.</option>';
    }
}

document.getElementById('btn-analyse').addEventListener('click', () => {
    const rowIdx = document.getElementById('address-selector').value;
    if (rowIdx === "") return;

    const rawObjects = extractAppliances(datasetRows[rowIdx], runtimeColumnMap);
    const processedPayload = mapToFormValues(rawObjects);

    document.getElementById('summary-heaters').innerHTML = processedPayload.heaters.length ? processedPayload.heaters.map(h => `<div class="device-item">🔹 ${h.formName} (Star: ${h.rating || 'N/A'}, Installed: ${h.year || 'N/A'})</div>`).join('') : '<div style="color:red; font-weight:bold;">None Identified</div>';
    document.getElementById('summary-coolers').innerHTML = processedPayload.coolers.length ? processedPayload.coolers.map(c => `<div class="device-item">🔹 ${c.formName} (Installed: ${c.year || 'N/A'})</div>`).join('') : '<div style="color:red; font-weight:bold;">None Identified</div>';
    document.getElementById('summary-hotwater').innerHTML = processedPayload.hotwater ? `<div class="device-item">🔹 ${processedPayload.hotwater.formName} (Value: ${processedPayload.hotwater.rating || 'N/A'})</div>` : '<div style="color:red; font-weight:bold;">None Identified</div>';

    manageSliders(processedPayload.heaters.length === 2, 'heating-slider-block', 'heater-ratio', 'lbl-heater1', 'lbl-heater2', 'Heater');
    manageSliders(processedPayload.coolers.length === 2, 'cooling-slider-block', 'cooling-ratio', 'lbl-cooler1', 'lbl-cooler2', 'Cooler');

    document.getElementById('btn-inject').dataset.payload = JSON.stringify(processedPayload);
    document.getElementById('analysis-output').style.display = 'block';
});

function manageSliders(visible, containerId, sliderId, lbl1, lbl2, title) {
    const block = document.getElementById(containerId);
    if (visible) {
        block.style.display = 'block';
        const slider = document.getElementById(sliderId);
        const update = () => {
            document.getElementById(lbl1).textContent = `${title} 1: ${slider.value}%`;
            document.getElementById(lbl2).textContent = `${title} 2: ${100 - slider.value}%`;
        };
        slider.oninput = update;
        update();
    } else { block.style.display = 'none'; }
}

document.getElementById('btn-inject').addEventListener('click', function() {
    const payload = JSON.parse(this.dataset.payload);
    clearFormTargetFields();

    if (payload.heaters.length === 1) {
        write('SpaceHeaterName1', payload.heaters[0].formName);
        write('SpaceHeaterPerformanceRating1', payload.heaters[0].rating);
        write('SpaceHeaterDuctInstallationYear1', payload.heaters[0].year);
        write('SpaceHeaterConditionedFloorAreaPercentage1', 100);
    } else if (payload.heaters.length >= 2) {
        let hRatio = parseInt(document.getElementById('heater-ratio').value);
        payload.heaters.forEach((h, i) => {
            let num = i + 1; if (num > 2) return;
            write(`SpaceHeaterName${num}`, h.formName);
            write(`SpaceHeaterPerformanceRating${num}`, h.rating);
            write(`SpaceHeaterDuctInstallationYear${num}`, h.year);
            write(`SpaceHeaterConditionedFloorAreaPercentage${num}`, num === 1 ? hRatio : (100 - hRatio));
        });
    }

    if (payload.coolers.length === 1) {
        write('SpaceCoolerName1', payload.coolers[0].formName);
        write('SpaceCoolerDuctInstallationYear1', payload.coolers[0].year);
        write('SpaceCoolerConditionedFloorAreaPercentage1', 100);
    } else if (payload.coolers.length >= 2) {
        let cRatio = parseInt(document.getElementById('cooling-ratio').value);
        payload.coolers.forEach((c, i) => {
            let num = i + 1; if (num > 2) return;
            write(`SpaceCoolerName${num}`, c.formName);
            write(`SpaceCoolerDuctInstallationYear${num}`, c.year);
            write(`SpaceCoolerConditionedFloorAreaPercentage${num}`, num === 1 ? cRatio : (100 - cRatio));
        });
    }

    if (payload.hotwater) {
        write('WaterHeaterType', payload.hotwater.formName);
        write('WaterHeaterPerformanceRating', payload.hotwater.rating);
    }

    if (payload.pool) {
        write('PoolSurfaceAream2', payload.pool.area.toFixed(2));
        write('PoolAverageDepthm', payload.pool.depth.toFixed(2));
        write('PoolVolume', payload.pool.volume.toFixed(2));
    }
    
    alert("Appliance extraction injected successfully!");
});

function write(targetId, dataVal) {
    const target = document.getElementById(targetId);
    if (target) {
        target.value = dataVal || '';
        target.dispatchEvent(new Event('change', { bubbles: true }));
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function clearFormTargetFields() {
    const fields = [
        'SpaceHeaterName1', 'SpaceHeaterPerformanceRating1', 'SpaceHeaterDuctInstallationYear1', 'SpaceHeaterConditionedFloorAreaPercentage1',
        'SpaceHeaterName2', 'SpaceHeaterPerformanceRating2', 'SpaceHeaterDuctInstallationYear2', 'SpaceHeaterConditionedFloorAreaPercentage2',
        'SpaceCoolerName1', 'SpaceCoolerPerformanceRating1', 'SpaceCoolerDuctInstallationYear1', 'SpaceCoolerConditionedFloorAreaPercentage1',
        'SpaceCoolerName2', 'SpaceCoolerPerformanceRating2', 'SpaceCoolerDuctInstallationYear2', 'SpaceCoolerConditionedFloorAreaPercentage2',
        'WaterHeaterType', 'WaterHeaterPerformanceRating', 'PoolSurfaceAream2', 'PoolAverageDepthm', 'PoolVolume'
    ];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// Run engine initialization on load
initializeSystemEngine();