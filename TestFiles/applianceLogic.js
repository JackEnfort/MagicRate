// STAGE 2: Block-Level Appliance Extractor Engine
function extractAppliances(row, map) {
    const extraction = { heaters: [], coolers: [], hotwater: null, pool: null };
    const read = (key) => { const idx = map[key]; return (idx !== undefined && idx !== -1) ? (row[idx] || "").trim() : ""; };

    // Process Heater Block 1
    let h1 = read('heater1_type');
    if (h1 && !h1.toLowerCase().includes("no heating")) {
        let lower = h1.toLowerCase();
        let isDuctedSystem = lower.includes("ducted") && !lower.includes("non-ducted");
        let hObj = { type: h1, ratingYear: "", rating: "", year: "", isDucted: isDuctedSystem };
        
        if (lower.includes("reverse cycle") || lower.includes("air conditioner")) {
            if (isDuctedSystem) {
                hObj.ratingYear = read('ducted_rcac1_year');
                hObj.rating = read('ducted_rcac1_heat');
                hObj.year = read('ducted_rcac1_install');
            } else {
                hObj.ratingYear = read('rcac1_year');
                hObj.rating = read('rcac1_heat');
            }
        } else if (lower.includes("ducted gas")) {
            hObj.rating = read('gas_ducted1_star');
            hObj.year = read('gas_ducted1_year');
        } else if (lower.includes("space heater")) {
            hObj.rating = read('space_heater1_star');
        } else if (lower.includes("electric heating non-rcac") || lower.includes("electric resistance")) {
            hObj.type = "Electric Resistance Heater";
        }
        extraction.heaters.push(hObj);
    }

    // Process Heater Block 2
    let h2 = read('heater2_type');
    if (h2 && !h2.toLowerCase().includes("no heating") && h2.toLowerCase() !== "no") {
        let lower = h2.toLowerCase();
        let isDuctedSystem = lower.includes("ducted") && !lower.includes("non-ducted");
        let hObj = { type: h2, ratingYear: "", rating: "", year: "", isDucted: isDuctedSystem };
        
        if (lower.includes("reverse cycle") || lower.includes("air conditioner")) {
            if (isDuctedSystem) {
                hObj.ratingYear = read('ducted_rcac2_year');
                hObj.rating = read('ducted_rcac2_heat');
                hObj.year = read('ducted_rcac2_install');
            } else {
                hObj.ratingYear = read('rcac2_year');
                hObj.rating = read('rcac2_heat');
            }
        } else if (lower.includes("ducted gas")) {
            hObj.rating = read('gas_ducted2_star');
            hObj.year = read('gas_ducted2_year');
        } else if (lower.includes("space heater")) {
            hObj.rating = read('space_heater2_star');
        } else if (lower.includes("electric heating non-rcac") || lower.includes("electric resistance")) {
            hObj.type = "Electric Resistance Heater";
        }
        extraction.heaters.push(hObj);
    }

    // Process Cooling Blocks
    let c1 = read('cooler1_type');
    if (c1 && !c1.toLowerCase().includes("no cooling")) {
        let coolerObj = { type: c1, subType: "", year: "" };
        if (c1.toLowerCase().includes("evaporative")) {
            coolerObj.subType = read('evap1_sub_type');
            coolerObj.year = read('evap1_install_year');
        } else { coolerObj.year = read('cool_only1_year'); }
        extraction.coolers.push(coolerObj);
    }

    let c2 = read('cooler2_type');
    if (c2 && !c2.toLowerCase().includes("no cooling")) {
        let coolerObj = { type: c2, subType: "", year: "" };
        if (c2.toLowerCase().includes("evaporative")) {
            coolerObj.subType = read('evap2_sub_type');
            coolerObj.year = read('evap2_install_year');
        } else { coolerObj.year = read('cool_only2_year'); }
        extraction.coolers.push(coolerObj);
    }

    // Process Hot Water Multi-Column Parameters
    let hw = read('water_type');
    if (hw) {
        extraction.hotwater = {
            type: hw,
            gasStar: read('gas_water_star'),
            gasYear: read('gas_water_year'),
            meps: read('electric_water_meps'),
            size: read('electric_water_size'),
            sysType: read('electric_water_sys_type'),
            roofTank: read('electric_water_roof_tank'),
            hphwsStp: read('hphws_stp'),
            solarStp: read('solar_water_stp')
        };
    }

    // Process Pools
    let len = parseFloat(read('pool_length')), wid = parseFloat(read('pool_width')), dep = parseFloat(read('pool_depth'));
    if (!isNaN(len) && !isNaN(wid)) {
        let area = len * wid;
        extraction.pool = { area: area, depth: !isNaN(dep) ? dep : 0, volume: !isNaN(dep) ? (area * dep) : 0 };
    }

    return extraction;
}

// STAGE 3: Form Configuration Mapping Engine
function mapToFormValues(extractedData) {
    const payload = { heaters: [], coolers: [], hotwater: null, pool: null };

    extractedData.heaters.forEach(h => {
        let lower = h.type.toLowerCase();
        let mapped = { formName: h.type, rating: h.rating, year: h.year };

        if (lower.includes("reverse cycle") || lower.includes("air conditioner")) {
            let yearKey = "2019";
            if (h.ratingYear.includes("2013")) yearKey = "2013";
            else if (h.ratingYear.includes("2010")) yearKey = "2010";

            let configGroup = RCAC_LOOKUP[yearKey] || RCAC_LOOKUP["2019"];
            mapped.formName = configGroup[h.isDucted ? "ducted" : "nonducted"];
        } else if (lower.includes("ducted gas") || lower.includes("gas ducted")) {
            mapped.formName = "Ducted Natural Gas Heater";
        } else if (lower.includes("space heater") || lower.includes("furnace")) {
            mapped.formName = "Non-ducted Natural Gas Heater";
        } else if (lower.includes("resistance") || lower.includes("non-rcac")) {
            mapped.formName = "Electric Resistance Heater";
        }
        payload.heaters.push(mapped);
    });

    extractedData.coolers.forEach(c => {
        let lower = c.type.toLowerCase();
        let mapped = { formName: c.type, year: c.year };

        if (lower.includes("evaporative")) {
            let ductLabel = (c.subType || "").toLowerCase().includes("non-ducted") ? "Non-ducted" : "Ducted";
            mapped.formName = `Evaporative cooler - ${ductLabel}`;
        } else if (lower.includes("reverse cycle") || lower.includes("air condition") || lower.includes("cooling only")) {
            mapped.formName = "Reverse Cycle Air Conditioner - 2013 Rating Non-ducted inverter"; 
        }
        payload.coolers.push(mapped);
    });

    if (extractedData.hotwater) {
        let lower = extractedData.hotwater.type.toLowerCase();
        let formName = "Natural gas storage";
        let performanceRating = "";

        if (lower.includes("gas")) {
            formName = "Natural gas storage";
            performanceRating = extractedData.hotwater.gasStar;
        } else if (lower.includes("heat pump") || lower.includes("hphws")) {
            formName = "Heat pump";
            performanceRating = extractedData.hotwater.hphwsStp;
        } else if (lower.includes("solar")) {
            formName = "Solar boosted";
            performanceRating = extractedData.hotwater.solarStp;
        } 
        else if (lower.includes("electric storage")) {
            let sizeToken = "large";
            let rawSize = extractedData.hotwater.size.toLowerCase();
            if (rawSize.includes("small") || (parseInt(rawSize) > 0 && parseInt(rawSize) <= 150)) {
                sizeToken = "small";
            }

            let mepsToken = "MEPS 2005";
            let rawMeps = extractedData.hotwater.meps.toLowerCase();
            if (rawMeps.includes("pre-2005") || rawMeps.includes("pre")) mepsToken = "pre-2005";
            else if (rawMeps.includes("post-2005")) mepsToken = "post-2005";

            let tariffToken = "day rate";
            let rawSys = extractedData.hotwater.sysType.toLowerCase();
            let rawRoof = extractedData.hotwater.roofTank.toLowerCase();
            if (rawSys.includes("night") || rawSys.includes("off-peak") || rawRoof.includes("yes")) {
                tariffToken = "night rate";
            }

            formName = `Electric storage - ${sizeToken} ${mepsToken} ${tariffToken}`;
            performanceRating = ""; 
        }

        payload.hotwater = { formName, rating: performanceRating };
    }

    if (extractedData.pool) payload.pool = extractedData.pool;

    return payload;
}