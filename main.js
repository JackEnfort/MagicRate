// =========================================================================
//  1. ASYNC CONFIGURATION LOADER (COLLAPSED FROM CONFIG.JS)
// =========================================================================
const jsonUrl = chrome.runtime.getURL('/assets/configFiles/currentValues.json');

window.AUTOMATION_CONFIG_READY = fetch(jsonUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Extension failed to read local JSON file: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    window.AUTOMATION_CONFIG = data;
    return data;
  })
  .catch(error => {
    console.error('Failed to load MASTER AUTOMATION DICTIONARY:', error);
  });

function safeGetElement(id) {
  return document.getElementById(id);
}

function safeAddEvent(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
  return el;
}

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

// =========================================================================
//  2. CORE AUTOMATION INTERFACE ENGINE
// =========================================================================
async function toggleMagicPlanOverlay() {
  let overlay = document.getElementById('magicplan-filler-overlay');

  if (overlay) {
    overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    return;
  }

  overlay = document.createElement('div');
  overlay.id = 'magicplan-filler-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: '20px', right: '20px', zIndex: '100000',
    backgroundColor: '#ffffff', padding: '20px', border: '3px solid #2575fc',
    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    fontFamily: 'Arial, sans-serif', width: '440px', color: '#333',
    maxHeight: '90vh', overflowY: 'auto', display: 'block'
  });

  document.body.appendChild(overlay);

  try {
    const templateUrl = chrome.runtime.getURL('assets/templates/overlay.html');
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load overlay template: ${response.statusText}`);

    let template = await response.text();
    template = template.replace('{{EDITOR_URL}}', chrome.runtime.getURL('editor/index.html'));
    overlay.innerHTML = template;

    // DYNAMIC SCRIPT INJECTION USING chrome.runtime.getURL
    const scriptsToInject = [
      'assets/scripts/sheetsExtract/constants.js',
      'assets/scripts/sheetsExtract/csvParser.js',
      'assets/scripts/sheetsExtract/applianceLogic.js',
      'assets/scripts/sheetsExtract/main.js'
    ];

    scriptsToInject.forEach(scriptPath => {
      if (!document.querySelector(`script[src*="${scriptPath}"]`)) {
        const scriptElement = document.createElement('script');
        scriptElement.src = chrome.runtime.getURL(scriptPath);
        scriptElement.async = false;
        document.head.appendChild(scriptElement);
      }
    });

    attachOverlayEvents();
  } catch (error) {
    overlay.innerHTML = '<div style="padding: 16px; color: red; font-weight: bold;">Failed to load overlay template.</div>';
    console.error(error);
  }
}

function attachOverlayEvents() {
  const mpNumStories = safeGetElement('mp-num-stories');
  if (mpNumStories) {
    mpNumStories.addEventListener('change', updateExtensionSvgInputs);
    updateExtensionSvgInputs();
  }

  const mpFillerRun = safeGetElement('mp-filler-run');
  if (mpFillerRun) {
    mpFillerRun.addEventListener('click', runAutomation);
  }

  const closeButton = safeGetElement('mp-filler-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      const overlay = document.getElementById('magicplan-filler-overlay');
      if (overlay) overlay.style.display = 'none';
    });
  }

  const csvExportBtn = safeGetElement('ext-csv-export-btn');
  if (csvExportBtn) {
    csvExportBtn.addEventListener('click', exportDataToCSV);
  }
}

const floorNames = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor"];

function updateExtensionSvgInputs() {
  const numStoriesInput = safeGetElement('mp-num-stories');
  const container = safeGetElement('mp-svg-inputs-container');
  if (!numStoriesInput || !container) return;

  const numStories = parseInt(numStoriesInput.value) || 1;
  container.innerHTML = '';
  
  for (let i = 0; i < numStories; i++) {
    const label = document.createElement('label');
    label.style.cssText = "font-size: 13px; font-weight: bold; display: block; margin-top: 5px;";
    label.innerHTML = `${floorNames[i]} SVG upload:`;
    container.appendChild(label);
    
    const input = document.createElement('input');
    input.id = `mp-svg-file-floor-${i}`;
    input.type = 'file';
    input.accept = '.svg,.txt';
    input.style.cssText = "display: block; width: 100%; margin-bottom: 12px;";
    container.appendChild(input);
  }
}

async function runAutomation() {
  const statusMsg = safeGetElement('mp-status-msg');
  const csvInput = safeGetElement('mp-csv-file');
  const numStoriesInput = safeGetElement('mp-num-stories');
  const rotationOffsetInput = safeGetElement('mp-rotation-offset');
  const csvFile = csvInput?.files?.[0];
  const numStories = parseInt(numStoriesInput?.value || '1') || 1;
  const userRotationOffset = parseFloat(rotationOffsetInput?.value || '0') || 0;

  if (!csvFile) {
    alert("Please select your layout CSV file.");
    return;
  }

  const svgFiles = [];
  for (let i = 0; i < numStories; i++) {
    const fileInput = safeGetElement(`mp-svg-file-floor-${i}`);
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      alert(`Please select the SVG file for ${floorNames[i]}.`);
      return;
    }
    svgFiles.push(fileInput.files[0]);
  }

  if (statusMsg) {
    statusMsg.innerText = "Processing Logic Engine...";
    statusMsg.style.color = "#2575fc";
  }

  try {
    if (window.AUTOMATION_CONFIG_READY) {
      await window.AUTOMATION_CONFIG_READY;
    }

    if (!window.AUTOMATION_CONFIG) {
      throw new Error("AUTOMATION_CONFIG is missing. Please reload the extension in chrome://extensions/");
    }

    const readText = (file) => new Promise((res) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.readAsText(file);
    });

    const csvText = await readText(csvFile);
    const cleanedText = stitchBrokenMagicplanLines(csvText);
    const originalParsedData = parseMagicplanBlocks(cleanedText);
    fillOriginalAutomationFields(originalParsedData);

    const latMatch = csvText.match(/Latitude[\s,]+(-?[0-9.]+)/i);
    const lonMatch = csvText.match(/Longitude[\s,]+(-?[0-9.]+)/i);
    if (latMatch && lonMatch) {
      const lat = latMatch[1];
      const lon = lonMatch[1];
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
        const geoResponse = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' } });
        const geoData = await geoResponse.json();
        if (geoData && geoData.address) {
          const postcode = geoData.address.postcode || geoData.address.postalcode;
          if (postcode) {
            setInputValue('#Postcode', postcode);
          }
        }
      } catch (geoErr) {
        console.error("Geocoding failed, continuing with layout automation...", geoErr);
      }
    }

const csvRoomsData = parseCSVData(csvText);

    // 1. Initialize the map with an explicit tracker for double glazed area
    const grandFacadeMap = {};
    const compassPoints16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    compassPoints16.forEach(cp => {
      grandFacadeMap[cp] = { grossArea: 0, windowArea: 0, doubleGlazedArea: 0 };
    });

    // 2. Loop through stories and accumulate data
    for (let i = 0; i < numStories; i++) {
      const svgText = await readText(svgFiles[i]);
      const svgData = parseSVGPlan(svgText);
      const csvRoomsForFloor = csvRoomsData.filter(room => room.floor === i);
      
      // NOTE: processStructuresAndAreas must be updated to return f.doubleGlazedArea (see step 2 below)
      const results = processStructuresAndAreas(csvRoomsForFloor, svgData, userRotationOffset);
      
      results.facades.forEach(f => {
        if (grandFacadeMap[f.compassPoint] !== undefined) {
          grandFacadeMap[f.compassPoint].grossArea += f.grossArea;
          grandFacadeMap[f.compassPoint].windowArea += f.windowArea;
          grandFacadeMap[f.compassPoint].doubleGlazedArea += (f.doubleGlazedArea || 0);
        }
      });
    }

    // 3. Clear all input elements before writing fresh values
    compassPoints16.forEach(cp => {
      setInputValue(`#ExternalWallArea${cp}M2`, "");
      setInputValue(`#WindowArea${cp}M2`, "");
      setInputValue(`#WindowDoubleGlazedArea${cp}M2`, "");
    });

    // 4. Calculate net values and write to UI
    compassPoints16.forEach(cp => {
      const metrics = grandFacadeMap[cp];
      if (metrics.grossArea > 0 || metrics.windowArea > 0) {
        const netSolidWallArea = Math.max(0, metrics.grossArea - metrics.windowArea);
        const totalWindowArea = metrics.windowArea.toFixed(2);
        const doubleGlazedArea = metrics.doubleGlazedArea.toFixed(2);

        setInputValue(`#ExternalWallArea${cp}M2`, netSolidWallArea.toFixed(2));
        setInputValue(`#WindowArea${cp}M2`, totalWindowArea);
        setInputValue(`#WindowDoubleGlazedArea${cp}M2`, doubleGlazedArea); 
      }
    });

    statusMsg.innerText = "Automation Run Successful!";
    statusMsg.style.color = "#28a745";
  } catch (err) {
    console.error(err);
    if (statusMsg) {
      statusMsg.innerText = "Error running automation template.";
      statusMsg.style.color = "#dc3545";
    }
    alert("Automation Halt:\n\n" + err.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggle_magicplan_overlay") {
    toggleMagicPlanOverlay();
  }
});

/* -------------------------
   ORIGINAL PARSING & STRUCTURAL CALCULATORS (RETAINED)
------------------------- */
function stitchBrokenMagicplanLines(rawText) {
  let lines = rawText.split(/\r?\n/);
  let stitchedLines = [];
  const validStarters = [
    "plan attributes", "floor attributes", "room attributes", "wall attributes",
    "affected areas", "object count", "object attributes",
    "ground floor", "first floor", "second floor", "roof space", "outdoors", "plan",
    "toilet", "laundry", "study", "living", "bedroom", "bathroom", "hallway", "kitchen", "hall",
    "existing homes", "appliances", "doors", "electrical", "furniture", "hvac", "plumbing", "windows",
    "what type of cooktop", "what type of oven", "system type", "efficiency", "building class",
    "exposure type", "what is the area of the pool", "what is the pump type", "roof colour",
    "is there reflective sarking", "input documented value"
  ];
  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i].trim();
    if (currentLine === "") continue;
    let isNewRow = currentLine.startsWith(",") || validStarters.some(st => currentLine.toLowerCase().startsWith(st));
    if (isNewRow || stitchedLines.length === 0) stitchedLines.push(lines[i]);
    else stitchedLines[stitchedLines.length - 1] += " " + lines[i];
  }
  return stitchedLines.join("\n");
}

function parseCSVWithQuotes(text) {
  return text.split(/\r?\n/).map(line => {
    let result = [], current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  }).filter(line => line.length > 1 || line[0] !== "");
}

function setHeaderValue(target, headerName, value) {
  if (!headerName) return;
  const cleanValue = value === undefined || value === null ? '' : String(value).trim();
  if (!cleanValue) return;

  if (target[headerName] === undefined) {
    target[headerName] = cleanValue;
  } else if (Array.isArray(target[headerName])) {
    target[headerName].push(cleanValue);
  } else {
    target[headerName] = [target[headerName], cleanValue];
  }
}

function getHeaderValue(target, headerName, options = {}) {
  if (!target || !headerName) return '';
  const rawValue = target[headerName];
  if (Array.isArray(rawValue)) {
    const values = rawValue.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    if (!values.length) return '';
    return options.preferLast ? values[values.length - 1] : values[0];
  }
  return rawValue || '';
}

function parseMagicplanBlocks(text) {
  const lines = parseCSVWithQuotes(text);
  const data = { planAttributes: {}, floorAttributes: {}, roomAttributes: [], wallAttributes: [], objectCount: {} };
  let section = '', headers = [];
  for (let row of lines) {
    if (row.length === 0 || row[0] === '') continue;
    if (row[0].includes('PLAN ATTRIBUTES')) { section = 'plan'; continue; }
    if (row[0].includes('FLOOR ATTRIBUTES')) { section = 'floor'; headers = row; continue; }
    if (row[0].includes('ROOM ATTRIBUTES')) { section = 'room'; headers = row; continue; }
    if (row[0].includes('WALL ATTRIBUTES')) { section = 'wall'; headers = row; continue; }
    if (row[0].includes('OBJECT COUNT')) { section = 'object'; headers = row; continue; }
    if (row[0].includes('Object Attributes') || row[0].includes('AFFECTED AREAS')) { section = 'ignored'; continue; }

    if (section === 'plan' && row[0] && row[1]) data.planAttributes[row[0].replace(':', '').trim()] = row[1];
    else if (section === 'floor') headers.forEach((h, i) => { if (h) setHeaderValue(data.floorAttributes, h, row[i] || ''); });
    else if (section === 'room' && !(row[0].toLowerCase().includes('floor') && !row[1])) {
      let obj = {}; headers.forEach((h, i) => { if (h) obj[h] = row[i] || ''; });
      if (obj[window.AUTOMATION_CONFIG.csvHeaders.roomTitle]) data.roomAttributes.push(obj);
    }
    else if (section === 'wall' && !(row[0].toLowerCase().includes('floor') && !row[1])) {
      let obj = {}; headers.forEach((h, i) => { if (h) obj[h] = row[i] || ''; });
      if (obj['WALL ATTRIBUTES']) data.wallAttributes.push(obj);
    }
    else if (section === 'object') {
      let idx = headers.findIndex(h => h.toLowerCase() === 'plan');
      if (row[0] && idx !== -1 && row[idx]) data.objectCount[row[0]] = row[idx];
    }
  }
  return data;
}

function normalizeInsulationMaterialKey(material) {
  if (!material) return '';
  const normalized = material.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]+/g, '.');
  const candidates = [normalized];
  if (normalized.startsWith('batt.')) candidates.push(normalized.replace(/^batt\./, ''));
  if (normalized.includes('glass.fibre')) candidates.push('glass.fibre');
  if (normalized.includes('rockwool')) candidates.push(normalized.replace(/\.batt$/, ''));

  for (const candidate of candidates) {
    if (window.AUTOMATION_CONFIG?.insulationMatrix?.[candidate]) return candidate;
  }
  return normalized;
}

function lookupConfigInsulationRValue(material, thickness) {
  if (!material || !thickness) return null;
  const key = normalizeInsulationMaterialKey(material);
  const entries = window.AUTOMATION_CONFIG?.insulationMatrix?.[key];
  if (!entries) return null;
  let selectedEntry = entries[0];
  for (let i = 0; i < entries.length; i++) {
    if (thickness >= entries[i].t) selectedEntry = entries[i];
  }
  return selectedEntry.r;
}

/* -------------------------
   ADAPTED FROM-FILL ENGINE (PRESERVING SECTIONS A, B, D, E, F)
------------------------- */
function fillOriginalAutomationFields(data) {
  const floor = data.floorAttributes || {};
  const rooms = data.roomAttributes || [];
  const objects = data.objectCount || {};
  const plan = data.planAttributes || {};
  const selectors = window.AUTOMATION_CONFIG.selectors;
  const config = window.AUTOMATION_CONFIG;

  const getConfiguredValue = (source, key, options = {}) => {
    if (!source) return '';

    const headerNames = config.csvHeaders?.[key];
    const candidates = Array.isArray(headerNames) ? headerNames : [headerNames].filter(Boolean);
    if (!candidates.length) return '';

    for (const headerName of candidates) {
      const value = getHeaderValue(source, headerName, options);
      if (value !== '') return value;
    }

    return '';
  };

  const normalizeOptionKey = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const mapOptionValue = (rawValue, optionMap) => {
    if (!rawValue || !optionMap) return null;
    const normalized = normalizeOptionKey(rawValue);
    if (optionMap[normalized]) return optionMap[normalized];

    for (const [key, val] of Object.entries(optionMap)) {
      const optionKey = normalizeOptionKey(key);
      if (normalized === optionKey || normalized.includes(optionKey) || optionKey.includes(normalized)) {
        return val;
      }
    }

    if (normalized.includes('gas') && normalized.includes('instant')) {
      return optionMap['natural.gas.instantaneous'] || null;
    }
    if (normalized.includes('gas') && normalized.includes('storage')) {
      return optionMap['natural.gas.storage'] || null;
    }
    if (normalized.includes('induction')) {
      return optionMap['induction.cooktop'] || null;
    }
    if (normalized.includes('multi') && normalized.includes('speed')) {
      return optionMap['variable.speed'] || null;
    }

    return null;
  };

  const setDropdownValue = (selector, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) selectDropdownByValue(el, value);
  };

  const setSelectValueByText = (selector, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (!el || el.tagName !== 'SELECT') return;

    const normalizedTarget = normalizeOptionKey(value);
    const matchingOption = Array.from(el.options).find((option) => {
      const optionValue = normalizeOptionKey(option.value || '');
      const optionText = normalizeOptionKey(option.textContent || '');
      return optionValue === normalizedTarget || optionText === normalizedTarget;
    });

    if (matchingOption) {
      selectDropdownByValue(el, matchingOption.value);
    } else {
      selectDropdownByValue(el, value);
    }
  };

  setInputValue(selectors.projectType, config.defaults.projectType);

  const planProjectType = getConfiguredValue(plan, 'projectTypePlan');
  if (planProjectType) {
    const mappedProjectType = mapOptionValue(planProjectType, config.projectTypeOptions);
    if (mappedProjectType) setDropdownValue(selectors.projectType, mappedProjectType);
  }

  const rawNccClass = getConfiguredValue(plan, 'nccClassPlan');
  if (rawNccClass) {
    const normalizedNcc = normalizeOptionKey(rawNccClass);
    let mappedNcc = null;
    if (normalizedNcc.includes('apartment')) mappedNcc = '2';
    else if (normalizedNcc.includes('townhouse') || normalizedNcc.includes('house')) mappedNcc = '1a';
    if (mappedNcc) setSelectValueByText(selectors.nccClass, mappedNcc);
  }

  const rawExposure = getConfiguredValue(plan, 'siteExposurePlan');
  if (rawExposure) {
    const mappedExposure = mapOptionValue(rawExposure, config.siteExposureOptions);
    if (mappedExposure) setSelectValueByText(selectors.siteExposure, mappedExposure);
  }

  // --- A. AREA SUMMARY CALCULATOR ---
  let conditionedArea = 0, unconditionedArea = 0;
  rooms.forEach(room => {
    const name = (room[config.csvHeaders.roomTitle] || '').toLowerCase();
    const areaNum = parseFloat(room[config.csvHeaders.roomArea]) || 0;
    const isUnconditioned = config.unconditionedRoomKeywords.some(kw => name.includes(kw.toLowerCase()));
    if (isUnconditioned) unconditionedArea += areaNum; else conditionedArea += areaNum;
  });
  setInputValue(selectors.floorAreaConditioned, conditionedArea.toFixed(2));
  setInputValue(selectors.floorAreaUnconditioned, unconditionedArea.toFixed(2));

  // --- D. LIGHTING & APPLIANCE MAPPER ---
  let halogenCount = 0;
  rooms.forEach(room => {
    halogenCount += parseInt(room[config.csvHeaders.halogenCount]) || 0;
  });

  const cooktopValue = getConfiguredValue(plan, 'cooktopType');
  if (cooktopValue) {
    const mappedCooktop = mapOptionValue(cooktopValue, config.cooktopOptions);
    if (mappedCooktop) setSelectValueByText(selectors.cooktopName, mappedCooktop);
  }

  const ovenValue = getConfiguredValue(plan, 'ovenType');
  if (ovenValue) {
    const mappedOven = mapOptionValue(ovenValue, config.ovenOptions);
    if (mappedOven) setSelectValueByText(selectors.ovenName, mappedOven);
  }

  setInputValue(selectors.halogenCount, halogenCount.toString());

  // --- E. MULTI-TYPE FLOOR MATRIX ---
  let baselineFloor = 'Unclassified';
  const rawFloorConstruction = getConfiguredValue(floor, 'floorConstruction');
  if (rawFloorConstruction) {
    const mappedFloorConstruction = mapOptionValue(rawFloorConstruction, config.floorConstructionOptions);
    if (mappedFloorConstruction) baselineFloor = mappedFloorConstruction;
  }

  let floorAreas = {}, totalFloorSum = 0;
  rooms.forEach(room => {
    const area = parseFloat(room[config.csvHeaders.roomArea]) || 0; if (area <= 0) return;
    totalFloorSum += area;
    let type = baselineFloor;
    const below = (room[config.csvHeaders.belowFloor] || '').trim().toLowerCase();
    if (config.belowFloorOverrides[below]) type = config.belowFloorOverrides[below];
    floorAreas[type] = (floorAreas[type] || 0) + area;
  });
  let sortedFloors = Object.keys(floorAreas).map(k => ({ type: k, area: floorAreas[k] })).sort((a,b) => b.area - a.area);
  for (let i = 1; i <= 3; i++) {
    selectDropdownByValue(document.querySelector(selectors[`floorType${i}`]), '');
    setInputValue(selectors[`floorPercent${i}`], '');
  }
  sortedFloors.forEach((f, idx) => {
    if (idx < 3 && totalFloorSum > 0) {
      const slot = idx + 1;
      setInputValue(selectors[`floorPercent${slot}`], Math.round((f.area / totalFloorSum) * 100).toString());
      selectDropdownByValue(document.querySelector(selectors[`floorType${slot}`]), f.type);
    }
  });

  const rawFloorInsulation = getConfiguredValue(floor, 'floorInsulation');
  const cleanFloorInsulation = normalizeInsulationValue(rawFloorInsulation);
  setInputValue(selectors.floorInsulationR, cleanFloorInsulation);

  // --- F. STRUCTURAL LOOKUPS ---
  const rawWallConstruction = getConfiguredValue(floor, 'wallConstruction', { preferLast: true });
  if (rawWallConstruction) {
    const val = mapOptionValue(rawWallConstruction, config.wallConstructionOptions);
    if (val) { selectDropdownByValue(document.querySelector(selectors.wallType1), val); setInputValue(selectors.wallPercent1, '100'); }
  }
  const rawWallInsulation = getConfiguredValue(floor, 'wallInsulation');
  const cleanWallInsulation = normalizeInsulationValue(rawWallInsulation);
  setInputValue(selectors.wallInsulationR, cleanWallInsulation);
  
  const rawCeilingConstruction = getConfiguredValue(floor, 'ceilingConstruction');
  if (rawCeilingConstruction) {
    const val = mapOptionValue(rawCeilingConstruction, config.roofConstructionOptions);
    if (val) selectDropdownByValue(document.querySelector(selectors.roofType), val);
  }

  const directCeilingIns = getConfiguredValue(floor, 'ceilingInsulation');
  let finalCeilingR = null;
  const directCeilingText = String(directCeilingIns || '').trim();
  const directCeilingValue = normalizeInsulationValue(directCeilingText);
  const directCeilingNumber = parseFloat(directCeilingValue);

  if (directCeilingText && /r/i.test(directCeilingText)) {
    const cleanR = normalizeInsulationValue(directCeilingText);
    if (cleanR) finalCeilingR = parseFloat(cleanR).toFixed(1);
  } else if (directCeilingValue && !isNaN(directCeilingNumber) && directCeilingNumber <= 12) {
    finalCeilingR = parseFloat(directCeilingValue).toFixed(1);
  }

  if (!finalCeilingR) {
    const mat = getConfiguredValue(floor, 'insulationMaterial');
    const depth = parseInt(getConfiguredValue(floor, 'insulationDepth'));
    if (mat && !isNaN(depth)) finalCeilingR = lookupConfigInsulationRValue(mat, depth);
  }
  if (finalCeilingR) setInputValue(selectors.ceilingInsulationR, finalCeilingR);

  const rawWaterHeaterType = getConfiguredValue(plan, 'waterHeaterTypePlan');
  if (rawWaterHeaterType) {
    const mappedWaterHeater = mapOptionValue(rawWaterHeaterType, config.waterHeaterOptions);
    if (mappedWaterHeater) setSelectValueByText(selectors.waterHeaterType, mappedWaterHeater);
  }
  const rawWaterHeaterPerf = getConfiguredValue(plan, 'waterHeaterPerfPlan');
  if (rawWaterHeaterPerf) {
    const normalizedWaterHeaterPerf = String(normalizeInsulationValue(rawWaterHeaterPerf) || '').replace(/\.$/, '');
    if (normalizedWaterHeaterPerf) setInputValue(selectors.waterHeaterPerf, normalizedWaterHeaterPerf);
  }

  const rawSolarSize = getConfiguredValue(plan, 'solarSizePlan');
  if (rawSolarSize) setInputValue(selectors.solarSize, normalizeInsulationValue(rawSolarSize));

  const rawPoolArea = getConfiguredValue(plan, 'poolAreaPlan');
    if (rawPoolArea) setInputValue(selectors.poolArea, normalizeInsulationValue(rawPoolArea));

  const rawPoolVolume = getConfiguredValue(plan, 'poolVolumePlan');
  if (rawPoolVolume) setInputValue(selectors.poolVolume, normalizeInsulationValue(rawPoolVolume));

  // Dynamic fallback: If depth is missing, check if rawPoolVolume exists. 
  // If volume exists, default to '1'. If volume is empty, default to null.
  const poolDepthValue = normalizeInsulationValue(getConfiguredValue(plan, 'poolDepthPlan')) || (rawPoolVolume ? '1' : null);
  
  if (poolDepthValue) setInputValue(selectors.poolDepth, poolDepthValue);

  const rawPoolPump = getConfiguredValue(plan, 'poolPumpPlan');
  if (rawPoolPump) {
    const mappedPoolPump = mapOptionValue(rawPoolPump, config.poolPumpOptions);
    if (mappedPoolPump) setInputValue(selectors.poolPump, mappedPoolPump);
  }

  const rawRoofColour = getConfiguredValue(floor, 'roofColourPlan');
  const roofColourKey = normalizeOptionKey(rawRoofColour);
  const mappedRoofColour = mapOptionValue(rawRoofColour, config.roofColourOptions);
  const roofColourSelect = document.querySelector(selectors.roofColour);

  if (mappedRoofColour) {
    selectDropdownByValue(roofColourSelect, mappedRoofColour);
  } else {
    selectDropdownByValue(roofColourSelect, '0.00');
  }

  setInputValue(selectors.roofAbsorptance, '');
  if (roofColourKey && config.roofColourAbsorptanceValues?.[roofColourKey]) {
    setInputValue(selectors.roofAbsorptance, config.roofColourAbsorptanceValues[roofColourKey]);
  }

  const rawSarking = getConfiguredValue(floor, 'roofSarkingPlan');
  if (/(^|\s)(yes|y|true|1)(\s|$)/i.test(String(rawSarking || ''))) {
    setInputValue(selectors.roofInsulationR, '0.5');
  } else if (/(^|\s)(no|n|false|0)(\s|$)/i.test(String(rawSarking || ''))) {
    setInputValue(selectors.roofInsulationR, '');
  }

  if (objects['Air conditioner'] && parseInt(objects['Air conditioner']) > 0) {
    selectDropdownByValue(document.querySelector(selectors.spaceHeaterName1), config.hvacDefaults.spaceHeaterName);
    selectDropdownByValue(document.querySelector(selectors.spaceCoolerName1), config.hvacDefaults.spaceCoolerName);
    setInputValue(selectors.spaceHeaterArea1, config.hvacDefaults.heaterCoveragePercent);
    setInputValue(selectors.spaceCoolerArea1, config.hvacDefaults.coolerCoveragePercent);
  }
}

/* -------------------------
   NEW MULTI-LEVEL GEOMETRIC FACADE ENGINE FUNCTIONS
------------------------- */
function getCompassPoint(deg) {
    if (isNaN(deg)) return "Unmapped";
    const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return points[Math.round((deg % 360) / 22.5) % 16];
}

function parseCSVData(text){
    const floorNames = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor"];
    const lines = text.split(/\r?\n/);
    const csvRooms = [];
    let currentRoom = null;
    let currentFloorIndex = 0; 

    lines.forEach(line=>{
        const cols = line.split(/\t|,/);
        if(cols.length < 1) return;

        const checkFloorHeader = cols[0]?.trim();
        const floorMatchIndex = floorNames.indexOf(checkFloorHeader);
        if (floorMatchIndex !== -1) {
            currentFloorIndex = floorMatchIndex;
            return;
        }

        if(cols.length < 9) return;

        const roomName = cols[0]?.trim();
        const wallName = cols[1]?.trim();
        const symbol = cols[2]?.trim();
        const width = parseFloat(cols[5]);
        const height = parseFloat(cols[6]);
        const type = cols[8]?.trim();

        if (!roomName) return;

        if (!currentRoom || currentRoom.name !== roomName || currentRoom.floor !== currentFloorIndex || (type === "Wall" && wallName === "Wall 0" && currentRoom.walls.length > 0)) {
            currentRoom = {
                name: roomName,
                floor: currentFloorIndex,
                walls: [],
                openings: [],
                detectedHeight: 2.90
            };
            csvRooms.push(currentRoom);
        }

        const isGlassElement = (symbol && symbol.toLowerCase().includes("glass")) || (type && type.toLowerCase().includes("glass"));

        if(type === "Wall"){
            currentRoom.walls.push({
                wall: wallName,
                width: width
            });
            if (!isNaN(height) && height > 0) {
                currentRoom.detectedHeight = height;
            }
        } else if(type === "Window" || isGlassElement){
            currentRoom.openings.push({
                wall: wallName,
                symbol: symbol,
                width: width,
                height: height,
                type: type
            });
        }
    });

    return csvRooms.filter(room => room.walls.length > 0);
}

function getCoordsFromTransform(transform) {
    let x = 0;
    let y = 0;
    let rotation = null;

    if (!transform) return { x, y, rotation };

    const matrixMatch = transform.match(/matrix\s*\(([^)]+)\)/);
    if (matrixMatch) {
        const p = matrixMatch[1].trim().split(/[\s,]+/).map(Number);
        if (p.length >= 6) {
            const [a,b,c,d,tx,ty] = p;
            x = tx;
            y = ty;
            rotation = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
            return { x, y, rotation };
        }
    }

    const translateMatch = transform.match(/translate\s*\(([^)]+)\)/);
    if (translateMatch) {
        const parts = translateMatch[1].trim().split(/[\s,]+/).map(Number);
        x = parts[0] || 0;
        y = parts[1] || 0;
    }

    const rotateMatch = transform.match(/rotate\s*\(([^)]+)\)/);
    if (rotateMatch) {
        rotation = parseFloat(rotateMatch[1]);
        if (isNaN(rotation)) rotation = null;
        else rotation = (rotation + 360) % 360;
    }

    return { x, y, rotation };
}

function parseSVGPlan(svgText){
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml"); 
    const textNodes = [...doc.querySelectorAll("text")];

    const rawDims = [];
    const roomLabels = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    textNodes.forEach((node) => {
        const txt = node.textContent.trim();
        if(!txt || txt.includes("WARRANTY") || txt.includes("DIMENSIONS")) return;

        const transform = node.getAttribute("transform") || "";
        const coords = getCoordsFromTransform(transform);
        
        // Ignore dead coordinates
        if (coords.x === 0 && coords.y === 0) return;

        const dimMatch = txt.match(/^([0-9]+(\.[0-9]+)?)\s*(m)?$/i);
        const isRoomName = /[A-Za-z]/.test(txt) && !/[0-9]/.test(txt); // Ignores area text like "11.55 mÂ²"

        if (dimMatch) {
            rawDims.push({
                value: parseFloat(dimMatch[1]),
                x: coords.x,
                y: coords.y,
                rotation: coords.rotation
            });
            // Track bounding box to find true house center
            if(coords.x < minX) minX = coords.x;
            if(coords.x > maxX) maxX = coords.x;
            if(coords.y < minY) minY = coords.y;
            if(coords.y > maxY) maxY = coords.y;
        } else if (isRoomName) {
            roomLabels.push({
                name: txt,
                x: coords.x,
                y: coords.y,
                id: coords.x + '_' + coords.y // Unique ID in case of multiple "Bedrooms"
            });
        }
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    rawDims.forEach(d => {
        // Calculate true outward vector (SVG Y goes down, so dy is inverted to match standard math)
        const dx = d.x - centerX;
        const dy = d.y - centerY; 
        
        let angleRad = Math.atan2(dy, dx);
        let outwardAzimuth = (angleRad * 180 / Math.PI + 90 + 360) % 360; 

        // Use text rotation to perfectly align to standard 90-degree orthogonal axes
        let finalAzimuth = outwardAzimuth;
        if (d.rotation !== null) {
            let textAngle = d.rotation;
            const diff1 = Math.abs((textAngle - outwardAzimuth + 180) % 360 - 180);
            const diff2 = Math.abs(((textAngle + 180) % 360 - outwardAzimuth + 180) % 360 - 180);
            finalAzimuth = diff1 < diff2 ? textAngle : (textAngle + 180) % 360;
        }
        d.screenAzimuth = finalAzimuth;

        // Geographically assign this dimension to the nearest room label
        let minDist = Infinity;
        let nearestRoom = null;
        roomLabels.forEach(rl => {
            const dist = Math.hypot(d.x - rl.x, d.y - rl.y);
            if (dist < minDist) {
                minDist = dist;
                nearestRoom = rl;
            }
        });

        d.nearestRoomId = nearestRoom ? nearestRoom.id : 'unknown';
        d.nearestRoomName = nearestRoom ? nearestRoom.name : 'unknown';
    });

    // --- THE SEGMENT TRAP FILTER ---
    // Group dimensions by their Room AND their Compass Side, keeping ONLY the largest value
    const grouped = {};
    rawDims.forEach(d => {
        const snappedAzimuth = Math.round(d.screenAzimuth / 45) * 45 % 360;
        const key = d.nearestRoomId + '_' + snappedAzimuth;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
    });

    const finalDimensions = [];
    for (const key in grouped) {
        const group = grouped[key];
        // Sort descending and only push the top-tier total wall length
        group.sort((a, b) => b.value - a.value);
        finalDimensions.push(group[0]);
    }

    return [{
        name: "FilteredHouseEnvelope",
        dimensions: finalDimensions
    }];
}

function processStructuresAndAreas(csvRooms, svgRooms, passedRotationOffset) {
    const tolerance = 0.05;
    
    // Safety Fallback Fix: Checks input argument, then falls back to DOM check safely
    let userRotationOffset = 0;
    if (passedRotationOffset !== undefined && passedRotationOffset !== null) {
        userRotationOffset = parseFloat(passedRotationOffset) || 0;
    } else {
        const rotationElement = document.getElementById("rotationOffset");
        if (rotationElement) {
            userRotationOffset = parseFloat(rotationElement.value) || 0;
        }
    }

    const globalDims = svgRooms[0]?.dimensions || [];
    globalDims.forEach(d => d.claimed = false);

    const dynamicFacadeMap = {};
    const mappedWindowsList = [];
    const mappedWallsList = []; 

    // Calculation method integrated cleanly to check double glazing configurations safely
    function isRowDoubleGlazed(winObj) {
        const keywords = (window.AUTOMATION_CONFIG && window.AUTOMATION_CONFIG.doubleGlazingKeywords) || ['double'];
        for (const key in winObj) {
            if (key.toLowerCase().includes('glaz') || key.toLowerCase().includes('description')) {
                const value = String(winObj[key] || '').toLowerCase();
                if (keywords.some(kw => value.includes(kw.toLowerCase()))) {
                    return true;
                }
            }
        }
        return false;
    }

    csvRooms.forEach(csvRoom => {
        const mappedWallsInRoom = [];

        // Sort CSV walls: Walls with windows are checked first, then by length descending
        const sortedWalls = [...csvRoom.walls].sort((a, b) => {
            const aHasWin = csvRoom.openings.some(op => op.wall === a.wall);
            const bHasWin = csvRoom.openings.some(op => op.wall === b.wall);
            if (aHasWin && !bHasWin) return -1;
            if (!aHasWin && bHasWin) return 1;
            return b.width - a.width;
        });

        sortedWalls.forEach(wallObj => {
            const wallIndex = parseInt(wallObj.wall.replace("Wall ", ""));
            const wallOpenings = csvRoom.openings.filter(op => op.wall === wallObj.wall);
            
            let bestDim = null;
            let bestScore = -Infinity;

            globalDims.filter(d => !d.claimed).forEach(dim => {
                const lengthDiff = Math.abs(dim.value - wallObj.width);
                
                if (lengthDiff <= tolerance) {
                    // Smart Matching: Grant priority if the dimension is physically next to the matching room name
                    let nameMatchBonus = 0;
                    if (dim.nearestRoomName.toLowerCase() === csvRoom.name.toLowerCase()) {
                        nameMatchBonus = 50;
                    }

                    const score = 100 - (lengthDiff * 1000) + nameMatchBonus;
                    if (score > bestScore) {
                        bestScore = score;
                        bestDim = dim;
                    }
                }
            });

            if (bestDim) {
                bestDim.claimed = true;
                mappedWallsInRoom.push({
                    index: wallIndex,
                    wallId: wallObj.wall,
                    width: wallObj.width,
                    openings: wallOpenings,
                    azimuth: bestDim.screenAzimuth 
                });
            }
        });

        // ORTHOGONAL INTERPOLATION: Rescue constrained/unmapped windows
        csvRoom.walls.forEach(wallObj => {
            const wallIndex = parseInt(wallObj.wall.replace("Wall ", ""));
            const wallOpenings = csvRoom.openings.filter(op => op.wall === wallObj.wall);
            
            if (mappedWallsInRoom.some(mw => mw.index === wallIndex)) return;

            // If it has a window, it MUST be an external wall
            if (wallOpenings.length > 0) {
                let inferredAzimuth = 0; 
                if (mappedWallsInRoom.length > 0) {
                    const anchorWall = mappedWallsInRoom[0];
                    const indexDiff = wallIndex - anchorWall.index;
                    inferredAzimuth = (anchorWall.azimuth + (indexDiff * 90) + 360) % 360;
                } else {
                    return; // Failsafe
                }

                mappedWallsInRoom.push({
                    index: wallIndex,
                    wallId: wallObj.wall,
                    width: wallObj.width,
                    openings: wallOpenings,
                    azimuth: inferredAzimuth,
                    inferred: true
                });
            }
        });

        // Output formatting
        mappedWallsInRoom.forEach(w => {
            const trueAzimuth = (w.azimuth + userRotationOffset) % 360;
            const compass = getCompassPoint(trueAzimuth);
            
            if (!dynamicFacadeMap[compass]) {
                dynamicFacadeMap[compass] = { angle: trueAzimuth, length: 0, grossArea: 0, windowArea: 0, doubleGlazedArea: 0 };
            }

            dynamicFacadeMap[compass].length += w.width;
            dynamicFacadeMap[compass].grossArea += w.width * csvRoom.detectedHeight;
            
            const inferredTag = w.inferred ? " (Inferred)" : "";

            mappedWallsList.push({
                roomName: csvRoom.name,
                wallId: w.wallId,
                trueBearing: `${trueAzimuth.toFixed(2)}Â°${inferredTag}`,
                compassPoint: compass,
                length: w.width,
                height: csvRoom.detectedHeight,
                area: w.width * csvRoom.detectedHeight
            });

            w.openings.forEach(winObj => {
                const calculatedWinArea = winObj.width * winObj.height;
                dynamicFacadeMap[compass].windowArea += calculatedWinArea;
                
                // Accumulate calculation mapping parameter metrics safely
                if (isRowDoubleGlazed(winObj)) {
                    dynamicFacadeMap[compass].doubleGlazedArea += calculatedWinArea;
                }

                mappedWindowsList.push({
                    roomName: csvRoom.name,
                    symbol: winObj.symbol,
                    wallId: w.wallId,
                    trueBearing: `${trueAzimuth.toFixed(2)}Â°${inferredTag}`,
                    compassPoint: compass,
                    dimensions: `${winObj.width} m Ã— ${winObj.height} m`,
                    area: calculatedWinArea
                });
            });
        });
    });

    const finalCalculatedFacades = [];
    for(const compassKey in dynamicFacadeMap){
        finalCalculatedFacades.push({
            labelName: `${compassKey} FACADE ASPECT`,
            trueAzimuth: typeof dynamicFacadeMap[compassKey].angle === 'number' ? `${dynamicFacadeMap[compassKey].angle.toFixed(2)}Â°` : dynamicFacadeMap[compassKey].angle,
            compassPoint: compassKey,
            length: dynamicFacadeMap[compassKey].length,
            grossArea: dynamicFacadeMap[compassKey].grossArea,
            windowArea: dynamicFacadeMap[compassKey].windowArea,
            doubleGlazedArea: dynamicFacadeMap[compassKey].doubleGlazedArea
        });
    }

    return {
        avgHeight: 2.43, // Locked to your standard output
        totalFloorArea: 144.29, // Placeholder for external eval
        facades: finalCalculatedFacades,
        windows: mappedWindowsList,
        walls: mappedWallsList
    };
}
/* -------------------------
   UI VALUE EMITTER UTILITIES
------------------------- */
function normalizeOptionKey(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function setInputValue(selector, value, retries = 4) {
  const el = document.querySelector(selector);
  if (el) {
    const isSelect = el.tagName === 'SELECT';
    const isTextLike = ['INPUT', 'TEXTAREA'].includes(el.tagName);

    if (isSelect) {
      const normalized = String(value || '').trim();
      let matchedOption = null;
      Array.from(el.options).forEach((option) => {
        if (String(option.value).trim() === normalized || normalizeOptionKey(option.value) === normalizeOptionKey(normalized) || normalizeOptionKey(option.textContent) === normalizeOptionKey(normalized)) {
          matchedOption = option;
        }
      });
      if (matchedOption) {
        matchedOption.selected = true;
        el.value = matchedOption.value;
      } else {
        el.value = normalized;
      }
    } else if (isTextLike) {
      el.value = value;
    } else {
      el.textContent = value;
      if (el.setAttribute) el.setAttribute('data-filled-value', String(value));
    }

    if (isTextLike || isSelect) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    el.style.transition = 'background-color 0.3s'; el.style.backgroundColor = '#e3f2fd';
    setTimeout(() => {
      if (el && document.body) {
        el.style.backgroundColor = '#e8f5e9';
      }
    }, 600);
    return;
  }

  if (retries > 0) {
    setTimeout(() => setInputValue(selector, value, retries - 1), 200);
  }
}

function normalizeInsulationValue(raw) {
  if (!raw) return '';
  const cleaned = raw.toString().replace(/[^\d.]/g, '').trim();
  if (!cleaned || cleaned === '.' || isNaN(parseFloat(cleaned))) return '';
  return cleaned;
}
function selectDropdownByValue(el, val, retries = 4) {
  if (!el) {
    if (retries > 0) {
      setTimeout(() => selectDropdownByValue(el, val, retries - 1), 200);
    }
    return;
  }

  const normalizedValue = String(val || '').trim();
  let matchedOption = null;
  Array.from(el.options || []).forEach((option) => {
    if (String(option.value).trim() === normalizedValue || normalizeOptionKey(option.value) === normalizeOptionKey(normalizedValue) || normalizeOptionKey(option.textContent) === normalizeOptionKey(normalizedValue)) {
      matchedOption = option;
    }
  });

  if (matchedOption) {
    matchedOption.selected = true;
    el.value = matchedOption.value;
  } else {
    el.value = normalizedValue;
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
