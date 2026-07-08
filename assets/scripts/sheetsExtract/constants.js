const CONFIG = {
    sheetId: '1UM82f_iHgekjfH3qCSW7AWvIJ2VDxjVQTT5DOCXGanw', 
    sheetTabName: 'HeatingCoolingDump'
};

// Clean exact/substring token matches pointing directly to your rewritten column names
const COLUMN_RULES = {
    address: { tokens: ["address"], fallback: 3 },
    
    // Heater 1 Input Definitions
    heater1_type: { tokens: ["heater type 1", "natural gas space heater gas fuel type", "space heater fuel type", "space heater type", "natural gas space heater type"], fallback: 4 },
    gas_ducted1_star: { tokens: ["gas ducted heating star rating"], fallback: 6 },
    gas_ducted1_year: { tokens: ["gas ducted heating installation year"], fallback: 7 },
    ducted_rcac1_year: { tokens: ["ducted reverse cycle air conditioner star rating year"], fallback: 8 },
    ducted_rcac1_heat: { tokens: ["ducted reverse cycle air conditioner star rating heating"], fallback: 9 },
    ducted_rcac1_cool: { tokens: ["ducted reverse cycle air conditioner star rating cooling"], fallback: 10 },
    ducted_rcac1_install: { tokens: ["ducted reverse cycle air conditioner installation year"], fallback: 11 },
    rcac1_year: { tokens: ["reverse cycle air conditioner star rating year"], fallback: 12 },
    rcac1_heat: { tokens: ["reverse cycle air conditioner star rating heating"], fallback: 13 },
    rcac1_cool: { tokens: ["reverse cycle air conditioner star rating cooling"], fallback: 14 },
    space_heater1_fuel: { tokens: ["natural gas space heater gas fuel type", "natural gas space heater fuel type", "space heater gas fuel type"], fallback: 15 },
    space_heater1_star: { tokens: ["natural gas space heater star rating", "space heater star rating", "space heater 1 star rating", "natural gas space heater rating"], fallback: 16 },
    electric_non_rcac1_type: { tokens: ["electric heating non-rcac type"], fallback: 21 },
    
    // Heater 2 Input Definitions
    heater2_type: { tokens: ["heater 2 type", "space heater 2 type", "natural gas space heater 2 type", "space heater type 2"], fallback: 23 },
    rcac2_year: { tokens: ["reverse cycle air conditioner 2 star rating year"], fallback: 24 },
    rcac2_heat: { tokens: ["reverse cycle air conditioner 2 star rating heating"], fallback: 25 },
    rcac2_cool: { tokens: ["reverse cycle air conditioner 2 star rating cooling"], fallback: 26 },
    gas_ducted2_star: { tokens: ["gas ducted heating 2nd star rating"], fallback: 32 },
    gas_ducted2_year: { tokens: ["gas ducted heating 2nd installation year"], fallback: 33 },
    ducted_rcac2_year: { tokens: ["ducted reverse cycle air conditioner 2 star rating year"], fallback: 34 },
    ducted_rcac2_heat: { tokens: ["ducted reverse cycle air conditioner 2 star rating heating"], fallback: 35 },
    ducted_rcac2_cool: { tokens: ["ducted reverse cycle air conditioner 2 star rating cooling"], fallback: 36 },
    ducted_rcac2_install: { tokens: ["ducted reverse cycle air conditioner 2 installation year"], fallback: 37 },
    space_heater2_fuel: { tokens: ["gas space heater 2 gas fuel type", "natural gas space heater 2 gas fuel type", "space heater 2 gas fuel type"], fallback: 38 },
    space_heater2_star: { tokens: ["gas space heater 2 star rating", "space heater 2 star rating", "natural gas space heater 2 star rating"], fallback: 39 },
    electric_non_rcac2_type: { tokens: ["electric heating non-rcac 2 type"], fallback: 40 },

    // Cooling Profile Blocks
    cooler1_type: { tokens: ["cooling type"], fallback: 44 },
    evap1_sub_type: { tokens: ["evaporative cooling type"], fallback: 45 },
    evap1_install_year: { tokens: ["evaporative cooling install year"], fallback: 46 },
    cool_only1_year: { tokens: ["air conditioning cooling only install year"], fallback: 48 },

    cooler2_type: { tokens: ["cooling type 2"], fallback: 50 },
    cool_only2_year: { tokens: ["air conditioning cooling only 2 install year"], fallback: 52 },
    evap2_sub_type: { tokens: ["evaporative cooling 2 type"], fallback: 53 },
    evap2_install_year: { tokens: ["evaporative cooling 2 install year"], fallback: 54 },

    // Hot Water Profile Blocks
    water_type: { tokens: ["hot water system type"], fallback: 58 },
    solar_water_stp: { tokens: ["solar boosted hot water system stcs"], fallback: 60 },
    gas_water_star: { tokens: ["gas hot water star rating"], fallback: 63 },
    gas_water_year: { tokens: ["gas hot water dom or year of install"], fallback: 64 },
    
    // Granular Electric Storage Columns
    electric_water_meps: { tokens: ["electric hot water, storage meps data"], fallback: 65 },
    electric_water_size: { tokens: ["electric hot water, storage tank size"], fallback: 66 },
    electric_water_sys_type: { tokens: ["electric hot water, storage system type"], fallback: 67 },
    electric_water_roof_tank: { tokens: ["electric hot water, storage cold water feed tank in roof?"], fallback: 68 },
    
    hphws_stp: { tokens: ["hphws system stcs"], fallback: 70 },
    hphws_year: { tokens: ["hphws install year"], fallback: 71 },

    roof_colour: { tokens: ["roof colour and type", "roof color and type", "roof colour", "roof color"], fallback: 77 },
    roof_absorptance: { tokens: ["roof colour mean solar absorptance", "estimated roof colour mean solar absorptance", "roof colour mean solar absorbance", "roof absorptance"], fallback: 78 },
    solar_size: { tokens: ["solar system size", "solar pv system size", "solar size", "pv system size"], fallback: 76 },
    pool_pump: { tokens: ["pump type", "pool pump", "pool pump speed", "pump speed", "pool pump type"], fallback: 83 },

    // Pool Profile Blocks
    pool_length: { tokens: ["pool length"], fallback: 80 },
    pool_width: { tokens: ["pool width"], fallback: 81 },
    pool_depth: { tokens: ["average pool depth"], fallback: 82 }
};

const RCAC_LOOKUP = {
    "2019": {
        ducted: "Reverse Cycle Air Conditioner - 2019 Ducted GEMS ZERL",
        nonducted: "Reverse Cycle Air Conditioner - 2019 Non-ducted GEMS ZERL"
    },
    "2013": {
        ducted: "Reverse Cycle Air Conditioner - 2013 Rating Ducted inverter",
        nonducted: "Reverse Cycle Air Conditioner - 2013 Rating Non-ducted inverter"
    },
    "2010": {
        ducted: "Reverse Cycle Air Conditioner - 2010 Rating Ducted inverter",
        nonducted: "Reverse Cycle Air Conditioner - 2010 Rating Non-ducted inverter"
    }
};

const WATER_LOOKUP = {
    "heat pump electric": "Heat pump",
    "heat pump": "Heat pump",
    "hphws": "Heat pump",
    "solar boosted": "Solar boosted",
    "solar": "Solar boosted",
    "gas storage": "Natural gas storage",
    "natural gas storage": "Natural gas storage",
    "gas instantaneous": "Natural gas instantaneous",
    "electric storage": "Electric storage - large MEPS 2005"
};