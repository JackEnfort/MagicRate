// Global configuration state engine
let currentConfig = null;

// 1. Entry Point: Wait for DOM to load, then fetch data and bind event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadConfigurationData();
  setupGlobalEventListeners();
});

// Fetch dynamic config.json from the Chrome Extension Bundle
async function loadConfigurationData() {
  try {
    const jsonUrl = chrome.runtime.getURL('./assets/configFiles/currentValues.json');
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    currentConfig = await response.json();
    initializeUI();
  } catch (error) {
    console.error('Failed to load local config.json file:', error);
    alert('Error loading configuration asset file. Check your console logs.');
  }
}

// 2. Setup Central Event Delegation Engine
function setupGlobalEventListeners() {
  document.addEventListener('click', (event) => {
    const target = event.target;

    // Handle "Compile Configuration Script" Button click
    if (target.id === 'compile-btn' || (target.classList.contains('btn') && target.textContent.includes('Compile'))) {
      generateJSON();
      return;
    }

    // Handle "Copy to Clipboard" Button click
    if (target.id === 'copy-btn' || (target.classList.contains('btn') && target.textContent.includes('Copy'))) {
      copyToClipboard();
      return;
    }

    // Handle "Delete Row" Button click
    if (target.classList.contains('action-delete-row')) {
      target.closest('tr').remove();
      return;
    }

    // Handle "+ Add Row" Button click
    if (target.classList.contains('action-add-row')) {
      const sectionId = target.getAttribute('data-id');
      addTableRow(sectionId);
      return;
    }

    // Handle Tag Close (Remove Tag) click
    if (target.classList.contains('tag-close')) {
      const type = target.getAttribute('data-type');
      const index = parseInt(target.getAttribute('data-index'), 10);
      removeTag(type, index);
      return;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.id && event.target.id.startsWith('add-') && event.target.id.endsWith('-input')) {
      event.preventDefault();
      const type = event.target.id.split('-')[1];
      addTag(type);
    }
  });
}

// 3. UI Setup Initialization Engine
function initializeUI() {
  if (!currentConfig) return;

  document.getElementById('def-projectType').value = currentConfig.defaults?.projectType || "Existing";
  renderTags('unconditioned', currentConfig.unconditionedRoomKeywords || []);
  renderTags('glazing', currentConfig.doubleGlazingKeywords || []);
  
  const sections = [
    { id: 'csvHeaders', title: 'CSV Import Headers (Mapping Target Column Names)' },
    { id: 'selectors', title: 'Web Form UI Dom Element Selectors (#ID)' },
    { id: 'nccClassOptions', title: 'NCC Class Code Conversions' },
    { id: 'projectTypeOptions', title: 'Project Type Selections Dictionary' },
    { id: 'siteExposureOptions', title: 'Site Exposure Configurations' },
    { id: 'floorConstructionOptions', title: 'Floor Structure System Types' },
    { id: 'belowFloorOverrides', title: 'Below Floor Structural Overrides' },
    { id: 'wallConstructionOptions', title: 'External Enclosure Wall Facade Profiles' },
    { id: 'roofConstructionOptions', title: 'Roof Framing & Top Layer Core Materials' },
    { id: 'spaceHeaterOptions', title: 'HVAC Space Heating Machinery Infrastructure Units' },
    { id: 'spaceCoolerOptions', title: 'HVAC Space Cooling Infrastructure Options' },
    { id: 'waterHeaterOptions', title: 'Domestic Water Heating Machinery Options' },
    { id: 'cooktopOptions', title: 'Kitchen Hotplates Appliance Configuration' },
    { id: 'ovenOptions', title: 'Baking Ovens Machinery Options' },
    { id: 'poolPumpOptions', title: 'Swimming Pool Circulation Pump Profiles' },
    { id: 'hvacDefaults', title: 'Fallback Automatic Default HVAC Settings' },
    { id: 'wallOrientations', title: 'Default Magicplan Wall Vector Mapping Indices' }
  ];

  const container = document.getElementById('dictionaries-container');
  if (container) {
    container.innerHTML = '';
    sections.forEach(sec => {
      container.appendChild(createDictionaryCard(sec.id, sec.title, currentConfig[sec.id] || {}));
    });
  }
}

function renderTags(type, list) {
  const parent = document.getElementById(`${type}-tags`);
  if (!parent) return;
  parent.innerHTML = '';
  list.forEach((val, i) => {
    parent.innerHTML += `<div class="tag"><span>${val}</span><span class="tag-close" data-type="${type}" data-index="${i}">&times;</span></div>`;
  });
}

function addTag(type) {
  const input = document.getElementById(`add-${type}-input`);
  if (!input) return;
  const val = input.value.trim();
  if(!val) return;
  const arrayKey = type === 'unconditioned' ? 'unconditionedRoomKeywords' : 'doubleGlazingKeywords';
  currentConfig[arrayKey].push(val);
  renderTags(type, currentConfig[arrayKey]);
  input.value = '';
}

function removeTag(type, index) {
  const arrayKey = type === 'unconditioned' ? 'unconditionedRoomKeywords' : 'doubleGlazingKeywords';
  currentConfig[arrayKey].splice(index, 1);
  renderTags(type, currentConfig[arrayKey]);
}

// 4. Creates a Card where BOTH Key and Value are dynamic input boxes
function createDictionaryCard(id, title, dictObj) {
  const div = document.createElement('div');
  div.className = 'card';
  div.id = `card-block-${id}`;
  
  let html = `<h3>${title}</h3><table id="table-${id}"><thead><tr><th>CSV Attribute.</th><th>Rapid Rate form Values</th><th style="width:70px;">Action</th></tr></thead><tbody>`;
  for(let key in dictObj) {
    html += `<tr>
      <td><input type="text" value="${key.replace(/"/g, '&quot;')}" class="dict-key-input"></td>
      <td><input type="text" value="${dictObj[key].replace(/"/g, '&quot;')}" class="dict-input"></td>
      <td><button class="btn btn-danger action-delete-row">Delete</button></td>
    </tr>`;
  }
  html += `</tbody></table><div class="flex-group">
    <input type="text" placeholder="New Key..." id="newkey-${id}" style="max-width:180px;">
    <input type="text" placeholder="New Value Mapping Target..." id="newval-${id}" style="max-width:280px;">
    <button class="btn btn-secondary action-add-row" style="padding:6px 12px;" data-id="${id}">+ Add Row</button>
  </div>`;
  
  div.innerHTML = html;
  return div;
}

function addTableRow(id) {
  const keyIn = document.getElementById(`newkey-${id}`);
  const valIn = document.getElementById(`newval-${id}`);
  if (!keyIn || !valIn) return;
  
  const k = keyIn.value.trim(); const v = valIn.value.trim();
  if(!k || !v) return;
  
  const tbody = document.querySelector(`#table-${id} tbody`);
  if (tbody) {
    tbody.innerHTML += `<tr>
      <td><input type="text" value="${k.replace(/"/g, '&quot;')}" class="dict-key-input"></td>
      <td><input type="text" value="${v.replace(/"/g, '&quot;')}" class="dict-input"></td>
      <td><button class="btn btn-danger action-delete-row">Delete</button></td>
    </tr>`;
  }
  keyIn.value = ''; valIn.value = '';
}

// 5. Compiles values to clean, raw JSON layout only
function generateJSON() {
  if (!currentConfig) return;

  const output = {
    defaults: { projectType: document.getElementById('def-projectType').value },
    unconditionedRoomKeywords: currentConfig.unconditionedRoomKeywords,
    doubleGlazingKeywords: currentConfig.doubleGlazingKeywords
  };

  const sections = ['csvHeaders','selectors','nccClassOptions','projectTypeOptions','siteExposureOptions','floorConstructionOptions','belowFloorOverrides','wallConstructionOptions','roofConstructionOptions','spaceHeaterOptions','spaceCoolerOptions','waterHeaterOptions','cooktopOptions','ovenOptions','poolPumpOptions','hvacDefaults','wallOrientations'];
  
  sections.forEach(sec => {
    output[sec] = {};
    const rows = document.querySelectorAll(`#table-${sec} tbody tr`);
    rows.forEach(tr => {
      const k = tr.querySelector('.dict-key-input').value.trim();
      const v = tr.querySelector('.dict-input').value;
      if (k !== "") {
        output[sec][k] = v;
      }
    });
  });

  output.wallOrientationOrder = currentConfig.wallOrientationOrder || ["N", "E", "S", "W"];
  output.insulationMatrix = currentConfig.insulationMatrix || {};

  // Formats output string as pure, raw JSON layout structure
  const formattedJSON = JSON.stringify(output, null, 2);
  
  const outputCode = document.getElementById('output-code');
  const outputContainer = document.getElementById('output-container');
  
  if (outputCode && outputContainer) {
    outputCode.innerText = formattedJSON;
    outputContainer.style.display = 'block';
    window.scrollTo({ top: outputContainer.offsetTop, behavior: 'smooth' });
  }
}

function copyToClipboard() {
  const outputCode = document.getElementById('output-code');
  if (outputCode) {
    navigator.clipboard.writeText(outputCode.innerText);
    alert('JSON Configuration copied directly to clipboard!');
  }
}