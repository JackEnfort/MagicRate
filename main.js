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
    const floorAttr = originalParsedData.floorAttributes;
    const rawGlazing = (floorAttr[window.AUTOMATION_CONFIG.csvHeaders.glazingType] || '').toLowerCase();
    const isDoubleGlazed = window.AUTOMATION_CONFIG.doubleGlazingKeywords.some(kw => rawGlazing.includes(kw.toLowerCase()));

    const grandFacadeMap = {};
    const compassPoints16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    compassPoints16.forEach(cp => {
      grandFacadeMap[cp] = { grossArea: 0, windowArea: 0 };
    });

    for (let i = 0; i < numStories; i++) {
      const svgText = await readText(svgFiles[i]);
      const svgData = parseSVGPlan(svgText);
      const csvRoomsForFloor = csvRoomsData.filter(room => room.floor === i);
      const results = processStructuresAndAreas(csvRoomsForFloor, svgData, userRotationOffset);
      results.facades.forEach(f => {
        if (grandFacadeMap[f.compassPoint] !== undefined) {
          grandFacadeMap[f.compassPoint].grossArea += f.grossArea;
          grandFacadeMap[f.compassPoint].windowArea += f.windowArea;
        }
      });
    }

    compassPoints16.forEach(cp => {
      setInputValue(`#ExternalWallArea${cp}M2`, "");
      setInputValue(`#WindowArea${cp}M2`, "");
      setInputValue(`#WindowDoubleGlazedArea${cp}M2`, "");
    });

    compassPoints16.forEach(cp => {
      const metrics = grandFacadeMap[cp];
      if (metrics.grossArea > 0 || metrics.windowArea > 0) {
        const netSolidWallArea = Math.max(0, metrics.grossArea - metrics.windowArea);
        setInputValue(`#ExternalWallArea${cp}M2`, netSolidWallArea.toFixed(2));
        if (isDoubleGlazed) {
          setInputValue(`#WindowDoubleGlazedArea${cp}M2`, metrics.windowArea.toFixed(2));
          setInputValue(`#WindowArea${cp}M2`, "0.00");
        } else {
          setInputValue(`#WindowArea${cp}M2`, metrics.windowArea.toFixed(2));
          setInputValue(`#WindowDoubleGlazedArea${cp}M2`, "0.00");
        }
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

// 3. Global Message Passing Listener: Hooks click event triggers from background.js
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
    "existing homes", "appliances", "doors", "electrical", "furniture", "hvac", "plumbing", "windows"
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
    else if (section === 'floor') headers.forEach((h, i) => { if (h) data.floorAttributes[h] = row[i] || ''; });
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

function lookupConfigInsulationRValue(material, thickness) {
  if (!material || !thickness) return null;
  let key = material.toLowerCase().trim().replace(/\s+/g, '.');
  const entries = window.AUTOMATION_CONFIG.insulationMatrix[key];
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
  const floor = data.floorAttributes, rooms = data.roomAttributes, walls = data.wallAttributes, objects = data.objectCount;
  const selectors = window.AUTOMATION_CONFIG.selectors;

  setInputValue(selectors.projectType, window.AUTOMATION_CONFIG.defaults.projectType);

  // --- A. AREA SUMMARY CALCULATOR ---
  let conditionedArea = 0, unconditionedArea = 0;
  rooms.forEach(room => {
    const name = room[window.AUTOMATION_CONFIG.csvHeaders.roomTitle].toLowerCase();
    const areaNum = parseFloat(room[window.AUTOMATION_CONFIG.csvHeaders.roomArea]) || 0;
    const isUnconditioned = window.AUTOMATION_CONFIG.unconditionedRoomKeywords.some(kw => name.includes(kw.toLowerCase()));
    if (isUnconditioned) unconditionedArea += areaNum; else conditionedArea += areaNum;
  });
  setInputValue(selectors.floorAreaConditioned, conditionedArea.toFixed(2));
  setInputValue(selectors.floorAreaUnconditioned, unconditionedArea.toFixed(2));

  // --- D. LIGHTING & APPLIANCE MAPPER ---
  let halogenCount = 0;
  rooms.forEach(room => {
    halogenCount += parseInt(room[window.AUTOMATION_CONFIG.csvHeaders.halogenCount]) || 0;
    if (room[window.AUTOMATION_CONFIG.csvHeaders.cooktopType]) {
      const val = window.AUTOMATION_CONFIG.cooktopOptions[room[window.AUTOMATION_CONFIG.csvHeaders.cooktopType].toLowerCase()];
      if (val) selectDropdownByValue(document.querySelector(selectors.cooktopName), val);
    }
    if (room[window.AUTOMATION_CONFIG.csvHeaders.ovenType]) {
      const val = window.AUTOMATION_CONFIG.ovenOptions[room[window.AUTOMATION_CONFIG.csvHeaders.ovenType].toLowerCase()];
      if (val) selectDropdownByValue(document.querySelector(selectors.ovenName), val);
    }
  });
  setInputValue(selectors.halogenCount, halogenCount.toString());

  // --- E. MULTI-TYPE FLOOR MATRIX ---
  let baselineFloor = 'Unclassified';
  if (floor[window.AUTOMATION_CONFIG.csvHeaders.floorConstruction]) {
    baselineFloor = window.AUTOMATION_CONFIG.floorConstructionOptions[floor[window.AUTOMATION_CONFIG.csvHeaders.floorConstruction].toLowerCase()] || 'Unclassified';
  }
  let floorAreas = {}, totalFloorSum = 0;
  rooms.forEach(room => {
    const area = parseFloat(room[window.AUTOMATION_CONFIG.csvHeaders.roomArea]) || 0; if (area <= 0) return;
    totalFloorSum += area;
    let type = baselineFloor;
    const below = (room[window.AUTOMATION_CONFIG.csvHeaders.belowFloor] || '').trim().toLowerCase();
    if (window.AUTOMATION_CONFIG.belowFloorOverrides[below]) type = window.AUTOMATION_CONFIG.belowFloorOverrides[below];
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

  const rawFloorInsulation = floor[window.AUTOMATION_CONFIG.csvHeaders.floorInsulation];
  const cleanFloorInsulation = normalizeInsulationValue(rawFloorInsulation);
  setInputValue(selectors.floorInsulationR, cleanFloorInsulation);

  // --- F. STRUCTURAL LOOKUPS ---
  if (floor[window.AUTOMATION_CONFIG.csvHeaders.wallConstruction]) {
    const val = window.AUTOMATION_CONFIG.wallConstructionOptions[floor[window.AUTOMATION_CONFIG.csvHeaders.wallConstruction].toLowerCase()];
    if (val) { selectDropdownByValue(document.querySelector(selectors.wallType1), val); setInputValue(selectors.wallPercent1, '100'); }
  }
  const rawWallInsulation = floor[window.AUTOMATION_CONFIG.csvHeaders.wallInsulation];
  const cleanWallInsulation = normalizeInsulationValue(rawWallInsulation);
  setInputValue(selectors.wallInsulationR, cleanWallInsulation);
  
  if (floor[window.AUTOMATION_CONFIG.csvHeaders.ceilingConstruction]) {
    const val = window.AUTOMATION_CONFIG.roofConstructionOptions[floor[window.AUTOMATION_CONFIG.csvHeaders.ceilingConstruction].toLowerCase()];
    if (val) selectDropdownByValue(document.querySelector(selectors.roofType), val);
  }

  const directCeilingIns = floor[window.AUTOMATION_CONFIG.csvHeaders.ceilingInsulation];
  let finalCeilingR = null;

  if (directCeilingIns && !directCeilingIns.toLowerCase().includes('visual')) {
    const cleanR = normalizeInsulationValue(directCeilingIns);
    if (cleanR) finalCeilingR = parseFloat(cleanR).toFixed(1);
  }
  if (!finalCeilingR) {
    const mat = floor[window.AUTOMATION_CONFIG.csvHeaders.insulationMaterial];
    const depth = parseInt(floor[window.AUTOMATION_CONFIG.csvHeaders.insulationDepth]);
    if (mat && !isNaN(depth)) finalCeilingR = lookupConfigInsulationRValue(mat, depth);
  }
  if (finalCeilingR) setInputValue(selectors.ceilingInsulationR, finalCeilingR);

  if (objects['Air conditioner'] && parseInt(objects['Air conditioner']) > 0) {
    selectDropdownByValue(document.querySelector(selectors.spaceHeaterName1), window.AUTOMATION_CONFIG.hvacDefaults.spaceHeaterName);
    selectDropdownByValue(document.querySelector(selectors.spaceCoolerName1), window.AUTOMATION_CONFIG.hvacDefaults.spaceCoolerName);
    setInputValue(selectors.spaceHeaterArea1, window.AUTOMATION_CONFIG.hvacDefaults.heaterCoveragePercent);
    setInputValue(selectors.spaceCoolerArea1, window.AUTOMATION_CONFIG.hvacDefaults.coolerCoveragePercent);
  }
}

/* -------------------------
   NEW MULTI-LEVEL GEOMETRIC FACADE ENGINE FUNCTIONS
------------------------- */
function getCompassPoint(deg) {
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

    if(type === "Wall"){
      currentRoom.walls.push({ wall: wallName, width: width });
      if (!isNaN(height) && height > 0) {
        currentRoom.detectedHeight = height;
      }
    } else if(type === "Window"){
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
  let x = 0, y = 0, rotation = null;
  if (!transform) return { x, y, rotation };

  if (transform.includes("matrix")) {
    const m = transform.match(/matrix\s*\(([^)]+)\)/);
    if (m) {
      const p = m[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 6) {
        const [a,b,c,d,tx,ty] = p;
        x = tx; y = ty;
        rotation = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
      }
    }
  } else if (transform.includes("translate")) {
    const t = transform.match(/translate\s*\(([^)]+)\)/);
    if (t) {
      const parts = t[1].trim().split(/[\s,]+/).map(Number);
      x = parts[0]; y = parts[1] || 0;
    }
  }
  return { x, y, rotation };
}

function parseSVGPlan(svgText){
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml"); 
  const textNodes = [...doc.querySelectorAll("text")];

  const rawLabels = [];
  const rawSignatures = [];
  const exteriorDimensions = [];

  textNodes.forEach((node) => {
    const txt = node.textContent.trim();
    if(!txt || txt.includes("WARRANTY") || txt.includes("DIMENSIONS")) return;

    const transform = node.getAttribute("transform") || "";
    const coords = getCoordsFromTransform(transform);

    if(txt.includes("m²")){
      const areaMatch = txt.match(/([0-9.]+)\s*m²/);
      const sigMatch = txt.match(/([0-9.]+)\s*[×x]\s*([0-9.]+)/);
      rawSignatures.push({
        area: areaMatch ? parseFloat(areaMatch[1]) : 0,
        width: sigMatch ? parseFloat(sigMatch[1]) : null,
        height: sigMatch ? parseFloat(sigMatch[2]) : null,
        x: coords.x, y: coords.y
      });
    } 
    else if(/^[0-9]+\.[0-9]+$/.test(txt)){
      exteriorDimensions.push({ value: parseFloat(txt), x: coords.x, y: coords.y, rotation: coords.rotation });
    } 
    else if(/[A-Za-z]/.test(txt) && !txt.includes("m²")){
      rawLabels.push({ name: txt, x: coords.x, y: coords.y });
    }
  });

  const roomAnchors = [];
  rawLabels.forEach(rl => {
    const isDup = roomAnchors.some(r => r.name === rl.name && Math.hypot(r.x - rl.x, r.y - rl.y) < 30);
    if (!isDup) roomAnchors.push(rl);
  });

  const roomsList = [];
  roomAnchors.forEach(anchor => {
    let bestSig = null, minSigDist = Infinity;
    rawSignatures.forEach(sig => {
      const dist = Math.hypot(sig.x - anchor.x, sig.y - anchor.y);
      if (dist < minSigDist) { minSigDist = dist; bestSig = sig; }
    });

    roomsList.push({
      name: anchor.name, x: anchor.x, y: anchor.y,
      floorArea: (bestSig && minSigDist < 150) ? bestSig.area : 10,
      dimensions: [] 
    });
  });

  exteriorDimensions.forEach(d => {
    let closestRoom = null, minDist = Infinity;
    roomsList.forEach(r => {
      let dist = Math.hypot(d.x - r.x, d.y - r.y);
      if (dist < minDist) { minDist = dist; closestRoom = r; }
    });

    if (closestRoom && minDist < 550) {
      let textRotation = d.rotation;
      if (textRotation === null) return;

      const dx = d.x - closestRoom.x;
      const dy = d.y - closestRoom.y; 
      const vectorAzimuth = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;

      const option1 = textRotation;
      const option2 = (textRotation + 180) % 360;
      const getAngularDiff = (a, b) => Math.abs((a - b + 180) % 360 - 180);

      const trueScreenAzimuth = getAngularDiff(option1, vectorAzimuth) < getAngularDiff(option2, vectorAzimuth) ? option1 : option2;

      closestRoom.dimensions.push({ value: d.value, screenAzimuth: trueScreenAzimuth });
    }
  });

  return roomsList;
}

function processStructuresAndAreas(csvRooms, svgRooms, userRotationOffset){
  const tolerance = 0.05;
  const claimedSvgRooms = new Set();
  let totalWeightedHeightPool = 0, totalFloorAreaPool = 0;
  const matchedRoomPairs = [];

  csvRooms.forEach(csvRoom => {
    const candidates = svgRooms.filter(r => r.name === csvRoom.name && !claimedSvgRooms.has(r));
    if (candidates.length === 0) return;

    let bestSvgRoom = candidates[0];
    claimedSvgRooms.add(bestSvgRoom);

    totalWeightedHeightPool += (bestSvgRoom.floorArea * csvRoom.detectedHeight);
    totalFloorAreaPool += bestSvgRoom.floorArea;

    matchedRoomPairs.push({ csv: csvRoom, svg: bestSvgRoom, height: csvRoom.detectedHeight });
  });

  const areaWeightedAverageHeight = totalFloorAreaPool > 0 ? (totalWeightedHeightPool / totalFloorAreaPool) : 2.90;
  const dynamicFacadeMap = {};

  matchedRoomPairs.forEach(pair => {
    const csvRoom = pair.csv;
    const bestSvgRoom = pair.svg;
    const roomWallsProcessed = [];

    csvRoom.walls.forEach((wallObj) => {
      let bestDim = null, bestScore = -Infinity;
      bestSvgRoom.dimensions.forEach((dim) => {
        const lengthDiff = Math.abs(dim.value - wallObj.width);
        if (lengthDiff > tolerance) return;
        const score = 100 - (lengthDiff * 1000);
        if (score > bestScore) { bestScore = score; bestDim = dim; }
      });

      const wallOpenings = csvRoom.openings.filter(op => op.wall === wallObj.wall);
      if (bestDim === null && wallOpenings.length === 0) return;

      const trueAzimuth = bestDim ? ((bestDim.screenAzimuth + userRotationOffset) % 360) : userRotationOffset;
      const compass = getCompassPoint(trueAzimuth);
      let displayLength = bestDim ? bestDim.value : wallObj.width;

      if (!dynamicFacadeMap[compass]) {
        dynamicFacadeMap[compass] = { angle: trueAzimuth, length: 0, grossArea: 0, windowArea: 0 };
      }

      dynamicFacadeMap[compass].length += displayLength;
      dynamicFacadeMap[compass].grossArea += displayLength * areaWeightedAverageHeight;

      roomWallsProcessed.push({ wallId: wallObj.wall, compassPoint: compass });
    });

    csvRoom.openings.forEach(winObj => {
      const matchingWall = roomWallsProcessed.find(w => w.wallId === winObj.wall);
      if (matchingWall) {
        dynamicFacadeMap[matchingWall.compassPoint].windowArea += (winObj.width * winObj.height);
      }
    });
  });

  const finalCalculatedFacades = [];
  for(const compassKey in dynamicFacadeMap){
    finalCalculatedFacades.push({
      compassPoint: compassKey,
      grossArea: dynamicFacadeMap[compassKey].grossArea,
      windowArea: dynamicFacadeMap[compassKey].windowArea
    });
  }

  return { facades: finalCalculatedFacades };
}

/* -------------------------
   UI VALUE EMITTER UTILITIES
------------------------- */
function setInputValue(selector, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.style.transition = 'background-color 0.3s'; el.style.backgroundColor = '#e3f2fd';
    setTimeout(() => { el.style.backgroundColor = ''; }, 600);
  }
}

function normalizeInsulationValue(raw) {
  if (!raw) return '';
  const cleaned = raw.toString().replace(/[^\d.]/g, '').trim();
  if (!cleaned || cleaned === '.' || isNaN(parseFloat(cleaned))) return '';
  return cleaned;
}
function selectDropdownByValue(el, val) {
  if (!el) return;
  el.value = val;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
