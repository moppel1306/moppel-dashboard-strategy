// ====================================================================
// VIEW STRATEGY - SECURITY (Schlösser + Türen/Garagen + Fenster) - OPTIMIERT
// ====================================================================
import { getExcludedLabels } from '../utils/simon42-helpers.js';

class Simon42ViewSecurityStrategy {
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
    const hiddenFromConfig = new Set();
    if (config.config?.areas_options) {
      for (const areaOptions of Object.values(config.config.areas_options)) {
        // Alle relevanten Gruppen durchsuchen
        const relevantGroups = ['covers', 'covers_curtain', 'switches'];
        relevantGroups.forEach(group => {
          if (areaOptions.groups_options?.[group]?.hidden) {
            areaOptions.groups_options[group].hidden.forEach(id => hiddenFromConfig.add(id));
          }
        });
      }
    }

    // Gruppiere nach Typ
    const locks = [];
    const doors = []; // Cover mit door/gate device_class
    const garages = []; // Cover mit garage device_class
    const windows = []; // Binary Sensors mit door/window device_class

    // OPTIMIERT: Filter-Logik
    entities
      .filter(e => {
        const id = e.entity_id;
        
        // 1. Hidden/Disabled-Checks (Registry)
        if (e.hidden === true) return false;
        if (e.hidden_by) return false;
        if (e.disabled_by) return false;
        
        // 2. Entity Category Check
        if (e.entity_category === 'config' || e.entity_category === 'diagnostic') return false;
        
        // 3. State-Existence-Check
        if (hass.states[id] === undefined) return false;
        
        // 4. Exclude-Checks (Set-Lookup = O(1))
        if (excludeSet.has(id)) return false;
        if (hiddenFromConfig.has(id)) return false;
        
        return true;
      })
      .forEach(entity => {
        const entityId = entity.entity_id;
        const state = hass.states[entityId];
        if (!state) return;
        
        // Domain-Checks mit frühem Return
        if (entityId.startsWith('lock.')) {
          locks.push(entityId);
          return;
        }
        
        if (entityId.startsWith('cover.')) {
          const deviceClass = state.attributes?.device_class;
          if (deviceClass === 'garage') {
            garages.push(entityId);
          } else if (['door', 'gate'].includes(deviceClass)) {
            doors.push(entityId);
          }
          return;
        }
        
        if (entityId.startsWith('binary_sensor.')) {
          const deviceClass = state.attributes?.device_class;
          if (['door', 'window', 'garage_door', 'opening'].includes(deviceClass)) {
            const hassEntry = hass.entities?.[entityId];
            const labels = hassEntry?.labels || [];
            if (!labels.includes('no_summary')) {
              windows.push(entityId);
            }
          }
        }
      });

    const sections = [];

    // Schlösser Section
    if (locks.length > 0) {
      const locksUnlocked = locks.filter(e => hass.states[e]?.state === 'unlocked');
      const locksLocked = locks.filter(e => hass.states[e]?.state === 'locked');
      
      const lockCards = [];
      
      if (locksUnlocked.length > 0) {
        lockCards.push({
          type: "heading",
          heading: "🔓 Schlösser - Entriegelt",
          heading_style: "subtitle",
          badges: [
            {
              type: "entity",
              entity: locksUnlocked[0],
              show_name: false,
              show_state: false,
              tap_action: {
                action: "perform-action",
                perform_action: "lock.lock",
                target: { entity_id: locksUnlocked }
              },
              icon: "mdi:lock"
            }
          ]
        });
        lockCards.push(...withAreaGroups(locksUnlocked, entity => ({
          type: "tile", entity, features: [{ type: "lock-commands" }], state_content: "last_changed"
        })));
      }
      
      if (locksLocked.length > 0) {
        lockCards.push({
          type: "heading",
          heading: "🔒 Schlösser - Verriegelt",
          heading_style: "subtitle"
        });
        lockCards.push(...withAreaGroups(locksLocked, entity => ({
          type: "tile", entity, features: [{ type: "lock-commands" }], state_content: "last_changed"
        })));
      }
      
      if (lockCards.length > 0) {
        sections.push({
          type: "grid",
          cards: lockCards
        });
      }
    }

    // Türen/Tore Section
    if (doors.length > 0) {
      const doorsOpen = doors.filter(e => hass.states[e]?.state === 'open');
      const doorsClosed = doors.filter(e => hass.states[e]?.state === 'closed');
      
      const doorCards = [];
      
      if (doorsOpen.length > 0) {
        doorCards.push({
          type: "heading",
          heading: "🚪 Türen & Tore - Offen",
          heading_style: "subtitle",
          badges: [
            {
              type: "entity",
              entity: doorsOpen[0],
              show_name: false,
              show_state: false,
              tap_action: {
                action: "perform-action",
                perform_action: "cover.close_cover",
                target: { entity_id: doorsOpen }
              },
              icon: "mdi:arrow-down"
            }
          ]
        });
        doorCards.push(...withAreaGroups(doorsOpen, entity => ({
          type: "tile", entity, features: [{ type: "cover-open-close" }], features_position: "inline", state_content: "last_changed"
        })));
      }
      
      if (doorsClosed.length > 0) {
        doorCards.push({
          type: "heading",
          heading: "🚪 Türen & Tore - Geschlossen",
          heading_style: "subtitle"
        });
        doorCards.push(...withAreaGroups(doorsClosed, entity => ({
          type: "tile", entity, features: [{ type: "cover-open-close" }], features_position: "inline", state_content: "last_changed"
        })));
      }
      
      if (doorCards.length > 0) {
        sections.push({
          type: "grid",
          cards: doorCards
        });
      }
    }

    // Garagen Section
    if (garages.length > 0) {
      const garagesOpen = garages.filter(e => hass.states[e]?.state === 'open');
      const garagesClosed = garages.filter(e => hass.states[e]?.state === 'closed');
      
      const garageCards = [];
      
      if (garagesOpen.length > 0) {
        garageCards.push({
          type: "heading",
          heading: "🏠 Garagen - Offen",
          heading_style: "subtitle",
          badges: [
            {
              type: "entity",
              entity: garagesOpen[0],
              show_name: false,
              show_state: false,
              tap_action: {
                action: "perform-action",
                perform_action: "cover.close_cover",
                target: { entity_id: garagesOpen }
              },
              icon: "mdi:arrow-down"
            }
          ]
        });
        garageCards.push(...withAreaGroups(garagesOpen, entity => ({
          type: "tile", entity,
          features: [{ type: "cover-open-close" }],
          features_position: "inline",
          state_content: "last_changed"
        })));
      }
      
      if (garagesClosed.length > 0) {
        garageCards.push({
          type: "heading",
          heading: "🏠 Garagen - Geschlossen",
          heading_style: "subtitle"
        });
        garageCards.push(...withAreaGroups(garagesClosed, entity => ({
          type: "tile", entity,
          features: [{ type: "cover-open-close" }],
          features_position: "inline",
          state_content: "last_changed"
        })));
      }
      
      if (garageCards.length > 0) {
        sections.push({
          type: "grid",
          cards: garageCards
        });
      }
    }

    // Fenster & Sensoren Section
    if (windows.length > 0) {
      const windowsOpen = windows.filter(e => hass.states[e]?.state === 'on');
      const windowsClosed = windows.filter(e => hass.states[e]?.state === 'off');
      
      const windowCards = [];
      
      if (windowsOpen.length > 0) {
        windowCards.push({
          type: "heading",
          heading: "🪟 Fenster & Öffnungen - Offen",
          heading_style: "subtitle"
        });
        windowCards.push(...withAreaGroups(windowsOpen, entity => ({
          type: "tile", entity, state_content: "last_changed"
        })));
      }
      
      if (windowsClosed.length > 0) {
        windowCards.push({
          type: "heading",
          heading: "🪟 Fenster & Öffnungen - Geschlossen",
          heading_style: "subtitle"
        });
        windowCards.push(...withAreaGroups(windowsClosed, entity => ({
          type: "tile", entity, state_content: "last_changed"
        })));
      }
      
      if (windowCards.length > 0) {
        sections.push({
          type: "grid",
          cards: windowCards
        });
      }
    }

    return {
      type: "sections",
      sections: sections
    };
  }
}

// Registriere Custom Element
customElements.define("ll-strategy-simon42-view-security", Simon42ViewSecurityStrategy);
