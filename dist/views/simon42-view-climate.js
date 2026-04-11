// ====================================================================
// VIEW STRATEGY - KLIMA/HEIZUNGEN (gruppiert nach Status)
// ====================================================================
import { getExcludedLabels, stripAreaName, isEntityHiddenOrDisabled } from '../utils/simon42-helpers.js';

class Simon42ViewClimateStrategy {
  static async generate(config, hass) {
    const entities = config.entities || [];
    const dashboardConfig = config.config || {};

    // Excluded Labels (no_dboard)
    const excludeSet = new Set(
      entities
        .filter(e => e.labels?.includes("no_dboard"))
        .map(e => e.entity_id)
    );

    // Hidden from config (areas_options.groups_options.climate.hidden)
    const hiddenFromConfig = new Set();
    const areasOptions = dashboardConfig.areas_options || {};
    for (var areaId in areasOptions) {
      var areaOpts = areasOptions[areaId];
      if (areaOpts && areaOpts.groups_options && areaOpts.groups_options.climate) {
        var hidden = areaOpts.groups_options.climate.hidden;
        if (hidden && Array.isArray(hidden)) {
          for (var h = 0; h < hidden.length; h++) {
            hiddenFromConfig.add(hidden[h]);
          }
        }
      }
    }

    // Sammle alle climate Entities
    var climateEntities = Object.keys(hass.states).filter(function(entityId) {
      // 1. Domain-Check
      if (entityId.indexOf('climate.') !== 0) return false;

      var state = hass.states[entityId];
      if (!state) return false;

      // 2. Exclude-Checks
      if (excludeSet.has(entityId)) return false;
      if (hiddenFromConfig.has(entityId)) return false;

      // 3. Registry-Check
      var registryEntry = hass.entities ? hass.entities[entityId] : null;
      if (registryEntry && registryEntry.hidden === true) return false;
      if (registryEntry && registryEntry.disabled_by) return false;

      // 4. Entity Category Check
      var entityCategory = state.attributes ? state.attributes.entity_category : null;
      if (entityCategory === 'config' || entityCategory === 'diagnostic') return false;

      // 5. Kühlschränke ausschließen
      var name = (state.attributes && state.attributes.friendly_name ? state.attributes.friendly_name : entityId).toLowerCase();
      if (name.indexOf('kühl') !== -1 || name.indexOf('fridge') !== -1 || name.indexOf('kuehl') !== -1) return false;

      return true;
    });

    // Gruppiere nach Status
    var heating = [];   // hvac_action === 'heating' oder state === 'heat' und aktiv
    var idle = [];      // state !== 'off' aber nicht aktiv heizend
    var off = [];       // state === 'off'

    climateEntities.forEach(function(entityId) {
      var state = hass.states[entityId];
      if (!state) return;

      var hvacAction = state.attributes ? state.attributes.hvac_action : null;
      var hvacState = state.state;

      if (hvacState === 'off') {
        off.push(entityId);
      } else if (hvacAction === 'heating') {
        heating.push(entityId);
      } else if (hvacAction === 'cooling') {
        heating.push(entityId); // Auch aktives Kühlen anzeigen
      } else {
        idle.push(entityId);
      }
    });

    // Area-Name Helper
    function getAreaName(entityId) {
      var reg = hass.entities ? hass.entities[entityId] : null;
      if (!reg) return null;
      var aId = reg.area_id || null;
      if (!aId && reg.device_id && hass.devices) {
        var dev = hass.devices[reg.device_id];
        if (dev) aId = dev.area_id;
      }
      if (!aId) return null;
      return (hass.areas && hass.areas[aId]) ? hass.areas[aId].name : null;
    }

    // Gruppiere Entities nach Area (Dashboard-Reihenfolge)
    function withAreaGroups(entityList, cardFn) {
      var areaOrder = (dashboardConfig.areas_display && dashboardConfig.areas_display.order) ? dashboardConfig.areas_display.order : [];
      var hiddenAreas = (dashboardConfig.areas_display && dashboardConfig.areas_display.hidden) ? dashboardConfig.areas_display.hidden : [];
      var allAreaIds = hass.areas ? Object.keys(hass.areas) : [];
      var ordered = [];
      var i;

      // Erst die in order definierten, dann den Rest
      for (i = 0; i < areaOrder.length; i++) {
        if (allAreaIds.indexOf(areaOrder[i]) !== -1 && hiddenAreas.indexOf(areaOrder[i]) === -1) {
          ordered.push(areaOrder[i]);
        }
      }
      for (i = 0; i < allAreaIds.length; i++) {
        if (areaOrder.indexOf(allAreaIds[i]) === -1 && hiddenAreas.indexOf(allAreaIds[i]) === -1) {
          ordered.push(allAreaIds[i]);
        }
      }

      // Map area_id -> area_name
      var areaIdToName = {};
      allAreaIds.forEach(function(id) {
        if (hass.areas[id]) areaIdToName[id] = hass.areas[id].name;
      });

      // Map area_name -> area_id (für Sortierung)
      var areaNameToId = {};
      for (var key in areaIdToName) {
        areaNameToId[areaIdToName[key]] = key;
      }

      // Gruppiere nach Area
      var byArea = {};
      var noArea = [];
      entityList.forEach(function(entityId) {
        var areaName = getAreaName(entityId);
        if (areaName) {
          if (!byArea[areaName]) byArea[areaName] = [];
          byArea[areaName].push(entityId);
        } else {
          noArea.push(entityId);
        }
      });

      // Sortiere nach Dashboard-Reihenfolge
      var cards = [];
      ordered.forEach(function(aId) {
        var aName = areaIdToName[aId];
        if (aName && byArea[aName] && byArea[aName].length > 0) {
          cards.push({
            type: "heading",
            heading: aName,
            heading_style: "subtitle",
            icon: "mdi:door"
          });
          byArea[aName].forEach(function(entityId) {
            cards.push(cardFn(entityId));
          });
          delete byArea[aName];
        }
      });

      // Restliche Areas (nicht in order)
      var remainingNames = Object.keys(byArea).sort();
      remainingNames.forEach(function(aName) {
        if (byArea[aName].length > 0) {
          cards.push({
            type: "heading",
            heading: aName,
            heading_style: "subtitle",
            icon: "mdi:door"
          });
          byArea[aName].forEach(function(entityId) {
            cards.push(cardFn(entityId));
          });
        }
      });

      // Entities ohne Area
      noArea.forEach(function(entityId) {
        cards.push(cardFn(entityId));
      });

      return cards;
    }

    // Card-Erstellung für ein Climate Entity
    function makeClimateCard(entityId) {
      var state = hass.states[entityId];
      var hvacMode = (state && state.attributes && state.attributes.hvac_mode) ? state.attributes.hvac_mode : (state ? state.state : 'off');

      var iconMap = {
        heat: "mdi:radiator",
        cool: "mdi:snowflake",
        off: "mdi:radiator-off",
        auto: "mdi:thermostat-auto",
        heat_cool: "mdi:thermostat",
        fan_only: "mdi:fan",
        dry: "mdi:water-percent"
      };

      var icon = iconMap[hvacMode] || "mdi:thermostat";

      return {
        type: "tile",
        entity: entityId,
        icon: icon,
        vertical: false,
        features: [
          { type: "target-temperature" }
        ],
        features_position: "bottom",
        state_content: ["hvac_action", "current_temperature", "target_temperature"]
      };
    }

    var sections = [];

    // Aktiv heizende/kühlende Thermostate
    if (heating.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "🔥 Aktiv heizend - " + heating.length + " " + (heating.length === 1 ? "Heizung" : "Heizungen"),
            heading_style: "title",
            icon: "mdi:radiator"
          }
        ].concat(withAreaGroups(heating, makeClimateCard))
      });
    }

    // Idle Thermostate (an, aber nicht aktiv heizend)
    if (idle.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "⏸️ Bereit - " + idle.length + " " + (idle.length === 1 ? "Heizung" : "Heizungen"),
            heading_style: "title",
            icon: "mdi:thermostat"
          }
        ].concat(withAreaGroups(idle, makeClimateCard))
      });
    }

    // Ausgeschaltete Thermostate
    if (off.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "⛔ Aus - " + off.length + " " + (off.length === 1 ? "Heizung" : "Heizungen"),
            heading_style: "title",
            icon: "mdi:radiator-off"
          }
        ].concat(withAreaGroups(off, makeClimateCard))
      });
    }

    // Fallback wenn keine Entities gefunden
    if (sections.length === 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "Keine Heizungen gefunden",
            heading_style: "title",
            icon: "mdi:radiator-off"
          }
        ]
      });
    }

    return {
      type: "sections",
      sections: sections
    };
  }
}

// Registriere Custom Element
customElements.define("ll-strategy-simon42-view-climate", Simon42ViewClimateStrategy);

console.log('✅ Simon42 View Climate Strategy loaded');
