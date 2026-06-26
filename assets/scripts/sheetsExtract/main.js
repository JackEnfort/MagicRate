// STAGE 4: Interface Rendering & DOM Injection Pipeline
let datasetRows = [];
let runtimeColumnMap = {};

function onElementReady(id, callback) {
    const element = document.getElementById(id);
    if (element) return callback(element);

    const observer = new MutationObserver((mutations, obs) => {
        const el = document.getElementById(id);
        if (el) {
            obs.disconnect();
            callback(el);
        }
    });

    observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

async function initializeSystemEngine() {
    onElementReady('address-selector', async (selector) => {
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

            onElementReady('btn-analyse', (btnAnalyse) => {
                btnAnalyse.disabled = false;
            });
        } catch (err) {
            console.error(err);
            selector.innerHTML = '<option value="">Error loading sheet values.</option>';
        }
    });
}

onElementReady('btn-analyse', (btnAnalyse) => {
    btnAnalyse.addEventListener('click', () => {
        const addressSelector = document.getElementById('address-selector');
        const rowIdx = addressSelector ? addressSelector.value : "";
        if (rowIdx === "") return;

        const rawObjects = extractAppliances(datasetRows[rowIdx], runtimeColumnMap);
        const processedPayload = mapToFormValues(rawObjects);
        const effectivePayload = {
            heaters: processedPayload.heaters.slice(0, 2),
            coolers: processedPayload.coolers.slice(0, 2),
            hotwater: processedPayload.hotwater,
            pool: processedPayload.pool,
            roofColour: processedPayload.roofColour,
            roofAbsorptance: processedPayload.roofAbsorptance,
            solarSize: processedPayload.solarSize,
            poolPump: processedPayload.poolPump
        };

        const summaryHeaters = document.getElementById('summary-heaters');
        const summaryCoolers = document.getElementById('summary-coolers');
        const summaryHotwater = document.getElementById('summary-hotwater');

        if (summaryHeaters) {
            summaryHeaters.innerHTML = effectivePayload.heaters.length ? effectivePayload.heaters.map(h => `<div class="device-item">🔹 ${h.formName} (Star: ${h.rating || 'N/A'}, Installed: ${h.year || 'N/A'})</div>`).join('') : '<div style="color:red; font-weight:bold;">None Identified</div>';
        }
        if (summaryCoolers) {
            summaryCoolers.innerHTML = effectivePayload.coolers.length ? effectivePayload.coolers.map(c => `<div class="device-item">🔹 ${c.formName} (Star: ${c.rating || 'N/A'}, Installed: ${c.year || 'N/A'})</div>`).join('') : '<div style="color:red; font-weight:bold;">None Identified</div>';
        }
        if (summaryHotwater) {
            summaryHotwater.innerHTML = processedPayload.hotwater ? `<div class="device-item">🔹 ${processedPayload.hotwater.formName} (Value: ${processedPayload.hotwater.rating || 'N/A'})</div>` : '<div style="color:red; font-weight:bold;">None Identified</div>';
        }

        manageSliders(effectivePayload.heaters.length === 2, 'heating-slider-block', 'heater-ratio', 'lbl-heater1', 'lbl-heater2', 'Heater');
        manageSliders(effectivePayload.coolers.length === 2, 'cooling-slider-block', 'cooling-ratio', 'lbl-cooler1', 'lbl-cooler2', 'Cooler');

        onElementReady('btn-inject', (btnInject) => {
            btnInject.dataset.payload = JSON.stringify(effectivePayload);
        });

        const analysisOutput = document.getElementById('analysis-output');
        if (analysisOutput) analysisOutput.style.display = 'block';
    });
});

function manageSliders(visible, containerId, sliderId, lbl1, lbl2, title) {
    const block = document.getElementById(containerId);
    const slider = document.getElementById(sliderId);
    if (!block || !slider) return;

    if (visible) {
        block.style.display = 'block';
        const update = () => {
            const label1 = document.getElementById(lbl1);
            const label2 = document.getElementById(lbl2);
            if (label1) label1.textContent = `${title} 1: ${slider.value}%`;
            if (label2) label2.textContent = `${title} 2: ${100 - slider.value}%`;
        };
        slider.oninput = update;
        update();
    } else {
        block.style.display = 'none';
    }
}

onElementReady('btn-inject', (btnInject) => {
    btnInject.addEventListener('click', function() {
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
        write('SpaceCoolerPerformanceRating1', payload.coolers[0].rating);
        write('SpaceCoolerDuctInstallationYear1', payload.coolers[0].year);
        write('SpaceCoolerConditionedFloorAreaPercentage1', 100);
    } else if (payload.coolers.length >= 2) {
        let cRatio = parseInt(document.getElementById('cooling-ratio').value);
        payload.coolers.forEach((c, i) => {
            let num = i + 1; if (num > 2) return;
            write(`SpaceCoolerName${num}`, c.formName);
            write(`SpaceCoolerPerformanceRating${num}`, c.rating);
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

    const absorptanceRaw = payload.roofAbsorptance ? payload.roofAbsorptance.toString().trim() : '';
    const absorptanceValue = absorptanceRaw.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*$/);

    if (absorptanceValue) {
        write('RoofColourMeanSolarAbsorptance', absorptanceValue[1]);
    } else if (absorptanceRaw === '') {
        const roofChoice = normalizeRoofColour(payload.roofColour);
        if (roofChoice) write('_RoofColour', roofChoice);
    }

    write('SolarPVSystemSizekW', payload.solarSize);
    write('PoolPumpName', normalizePoolPump(payload.poolPump));
    
    alert("Appliance extraction injected successfully!");
    });
});

function write(targetId, dataVal) {
    const target = document.getElementById(targetId);
    if (target) {
        if (target.tagName === 'SELECT') {
            setSelectValue(target, dataVal || '');
        } else {
            target.value = dataVal || '';
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function setSelectValue(select, value) {
    const raw = value ? value.toString().trim() : '';
    if (!raw) {
        select.value = '';
        return;
    }

    const optionByValue = Array.from(select.options).find(o => o.value === raw);
    if (optionByValue) {
        select.value = raw;
        return;
    }

    const normalizedRaw = raw.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9.\s-]/g, '');
    let bestMatch = null;
    for (const option of Array.from(select.options)) {
        const normalizedText = option.textContent.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9.\s-]/g, '');
        if (normalizedText === normalizedRaw || normalizedText.includes(normalizedRaw) || normalizedRaw.includes(normalizedText)) {
            bestMatch = option;
            break;
        }
    }
    if (bestMatch) {
        select.value = bestMatch.value;
        return;
    }

    select.value = raw;
}

function normalizeRoofColour(value) {
    if (!value) return '';
    const raw = value.toString().trim();
    const normalized = raw.toLowerCase();

    if (!isNaN(parseFloat(normalized)) && normalized !== '') return normalized;
    if (normalized.includes('roof colour and type') || normalized.includes('question type')) return '-- Other --';
    if (normalized.includes('black') && normalized.includes('concrete')) return 'Black concrete tiles';
    if (normalized.includes('brown') && normalized.includes('concrete')) return 'Brown concrete tiles';
    if (normalized.includes('concrete') && normalized.includes('uncolour')) return 'Concrete tiles (uncoloured)';
    if ((normalized.includes('fibro') || normalized.includes('fibeo')) && normalized.includes('cement')) return 'Fibro-cement (weathered)';
    if (normalized.includes('dark purple') && normalized.includes('clay')) return 'Dark purple clay tiles';
    if ((normalized.includes('galvansied') || normalized.includes('galvanised') || normalized.includes('galvanized')) && normalized.includes('iron') && normalized.includes('new')) return 'Galvanised iron (new)';
    if ((normalized.includes('galvansied') || normalized.includes('galvanised') || normalized.includes('galvanized')) && normalized.includes('iron') && normalized.includes('weathered')) return 'Galvanised iron (weathered)';
    if (normalized.includes('light cream')) return 'Light cream paint';
    if (normalized.includes('light green')) return 'Light green paint';
    if (normalized.includes('light grey')) return 'Light grey paint';
    if (normalized.includes('light red') && normalized.includes('clay')) return 'Light red clay tiles';
    if (normalized.includes('pink')) return 'Pink paint';
    if (normalized.includes('white')) return 'White paint';
    if (normalized.includes('other')) return '-- Other --';

    return raw;
}

function normalizePoolPump(value) {
    if (!value) return '';
    const normalized = value.toString().trim().toLowerCase();
    const lookup = {
        'multi or variable speed': 'Multi- or variable-speed',
        'multi or variable-speed': 'Multi- or variable-speed',
        'multi or variable-speed': 'Multi- or variable-speed',
        'two speed': 'Two-speed',
        'two-speed': 'Two-speed',
        'single-speed': 'Single-speed',
        'single speed': 'Single-speed'
    };
    return lookup[normalized] || value;
}

function clearFormTargetFields() {
    const fields = [
        'SpaceHeaterName1', 'SpaceHeaterPerformanceRating1', 'SpaceHeaterDuctInstallationYear1', 'SpaceHeaterConditionedFloorAreaPercentage1',
        'SpaceHeaterName2', 'SpaceHeaterPerformanceRating2', 'SpaceHeaterDuctInstallationYear2', 'SpaceHeaterConditionedFloorAreaPercentage2',
        'SpaceCoolerName1', 'SpaceCoolerPerformanceRating1', 'SpaceCoolerDuctInstallationYear1', 'SpaceCoolerConditionedFloorAreaPercentage1',
        'SpaceCoolerName2', 'SpaceCoolerPerformanceRating2', 'SpaceCoolerDuctInstallationYear2', 'SpaceCoolerConditionedFloorAreaPercentage2',
        'WaterHeaterType', 'WaterHeaterPerformanceRating', 'PoolSurfaceAream2', 'PoolAverageDepthm', 'PoolVolume',
        '_RoofColour', 'RoofColourMeanSolarAbsorptance', 'SolarPVSystemSizekW', 'PoolPumpName'
    ];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// Run engine initialization on load
initializeSystemEngine();