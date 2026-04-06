// ====================================================================
// VIEW STRATEGY - BATTERIEN (Batterie-Übersicht) - OPTIMIERT
// ====================================================================
// KEIN unnötiges Map-Caching mehr - nutzt direkt hass.entities[entityId]
// ====================================================================

import { getExcludedLabels } from '../utils/simon42-helpers.js';

class Simon42ViewBatteriesStrategy {
  static async generate(config, hass) {
    const { entities } = config;
    // Area grouping helpers
    const orderedAreaIds = (() => {
      const order = config.config?.areas_display?.order || [];
      const hidden = config.config?.areas_display?.hidden || [];
      const all = Object.keys(hass.areas || {});
      return [...order.filter(id => all.includes(id) && !hidden.includes(id)), ...all.filter(id => !order.includes(id) && !hidden.includes(id))];
    })();

    const getAreaId = (entityId) => {
      const reg = (hass.entities || {})[entityId];
      if (reg?.area_id) return reg.area_id;
      const dev = reg?.device_id ? (hass.devices || {})[reg.device_id] : null;
      return dev?.area_id || null;
    };

    const withAreaGroups = (entityIds, tileMapper) => {
      const byArea = {};
      entityIds.forEach(id => {
        const aId = getAreaId(id) || '__none__';
        if (!byArea[aId]) byArea[aId] = [];
        byArea[aId].push(id);
      });
      const cards = [];
      orderedAreaIds.forEach(aId => {
        if (!byArea[aId]) return;
        const name = (hass.areas || {})[aId]?.name;
        if (name) cards.push({ type: "heading", heading: name, heading_style: "subtitle", icon: "mdi:floor-plan" });
        byArea[aId].forEach(id => cards.push(tileMapper(id)));
      });
      if (byArea['__none__']) byArea['__none__'].forEach(id => cards.push(tileMapper(id)));
      return cards;
    };
    const excludeLabels = getExcludedLabels(entities);
    const excludeSet = new Set(excludeLabels);
    
    // Hole hidden entities aus areas_options (wenn config übergeben wurde)
    // Batterien könnten in verschiedenen Gruppen sein, daher alle durchsuchen
    const hiddenFromConfig = new Set();
    if (config.config?.areas_options) {
      for (const areaOptions of Object.values(config.config.areas_options)) {
        if (areaOptions.groups_options) {
          // Durchsuche alle Gruppen nach versteckten Entities
          for (const groupOptions of Object.values(areaOptions.groups_options)) {
            if (groupOptions.hidden) {
              groupOptions.hidden.forEach(id => hiddenFromConfig.add(id));
            }
          }
        }
      }
    }

    // OPTIMIERT: Filter-Reihenfolge - KEIN Map-Caching mehr!
    const batteryEntities = Object.keys(hass.states)
      .filter(entityId => {
        const state = hass.states[entityId];
        if (!state) return false;
        
        // 1. Battery-Check zuerst (String-includes ist schnell)
        const isBattery = entityId.includes('battery') || 
                         state.attributes?.device_class === 'battery';
        if (!isBattery) return false;
        
        // 2. Registry-Check - DIREKT aus hass.entities (O(1) Lookup)
        const registryEntry = hass.entities?.[entityId];
        if (registryEntry?.hidden === true) return false;
        
        // 3. Exclude-Checks (Set-Lookup = O(1))
        if (excludeSet.has(entityId)) return false;
        if (hiddenFromConfig.has(entityId)) return false;
        
        // 4. Value-Check am Ende
        const value = parseFloat(state.state);
        return !isNaN(value); // Nur numerische Werte
      });

    // Gruppiere nach Batteriestatus
    const critical = []; // < 20%
    const low = []; // 20-50%
    const good = []; // > 50%
    
    batteryEntities.forEach(entityId => {
      const state = hass.states[entityId];
      const value = parseFloat(state.state);
      
      if (value < 20) {
        critical.push(entityId);
      } else if (value <= 50) {
        low.push(entityId);
      } else {
        good.push(entityId);
      }
    });

    const sections = [];

    // Kritische Batterien
    if (critical.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🔴 Kritisch (< 20%) - ${critical.length} ${critical.length === 1 ? 'Batterie' : 'Batterien'}`,
            heading_style: "title"
          },
          ...critical.map(entity => ({
            type: "tile",
            entity: entity,
            vertical: false,
            state_content: ["state", "last_changed"],
            color: "red"
          }))
        ]
      });
    }

    // Niedrige Batterien
    if (low.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🟡 Niedrig (20-50%) - ${low.length} ${low.length === 1 ? 'Batterie' : 'Batterien'}`,
            heading_style: "title"
          },
          ...low.map(entity => ({
            type: "tile",
            entity: entity,
            vertical: false,
            state_content: ["state", "last_changed"],
            color: "yellow"
          }))
        ]
      });
    }

    // Gute Batterien
    if (good.length > 0) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🟢 Gut (> 50%) - ${good.length} ${good.length === 1 ? 'Batterie' : 'Batterien'}`,
            heading_style: "title"
          },
          ...good.map(entity => ({
            type: "tile",
            entity: entity,
            vertical: false,
            state_content: ["state", "last_changed"],
            color: "green"
          }))
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
customElements.define("ll-strategy-simon42-view-batteries", Simon42ViewBatteriesStrategy);
