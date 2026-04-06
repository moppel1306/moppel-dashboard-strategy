// ====================================================================
// VIEW STRATEGY - LICHTER (gruppiert nach Etage → Raum → Status)
// ====================================================================
import { getExcludedLabels } from '../utils/simon42-helpers.js';

class Simon42ViewLightsStrategy {
  static async generate(config, hass) {
    const excludeLabels = getExcludedLabels(config.config);
    const areasOptions = config.config?.areas_options || {};

    // Alle Lichter sammeln und filtern
    const allLights = Object.keys(hass.states).filter(id => {
      if (!id.startsWith('light.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      const reg = hass.entities?.[id];
      if (reg?.hidden === true) return false;
      if (state.attributes?.entity_category === 'config') return false;
      if (state.attributes?.entity_category === 'diagnostic') return false;
      if (excludeLabels.has(id)) return false;
      return true;
    });

    // Hilfsfunktion: Area-ID einer Entität ermitteln
    const getAreaId = (entityId) => {
      const reg = hass.entities?.[entityId];
      if (reg?.area_id) return reg.area_id;
      const device = reg?.device_id ? hass.devices?.[reg.device_id] : null;
      return device?.area_id || null;
    };

    // Hilfsfunktion: Floor-Name einer Area ermitteln
    const getFloorName = (areaId) => {
      const area = hass.areas?.[areaId];
      if (!area?.floor_id) return 'Sonstige';
      const floor = hass.floors?.[area.floor_id];
      return floor?.name || 'Sonstige';
    };

    const getFloorLevel = (areaId) => {
      const area = hass.areas?.[areaId];
      if (!area?.floor_id) return 999;
      const floor = hass.floors?.[area.floor_id];
      return floor?.level ?? 999;
    };

    const getAreaName = (areaId) => {
      return hass.areas?.[areaId]?.name || areaId;
    };

    // Lichter nach Status aufteilen
    const onLights = allLights.filter(id => hass.states[id]?.state === 'on');
    const offLights = allLights.filter(id => hass.states[id]?.state !== 'on');

    // Gruppiere Lichter nach Etage → Raum
    const groupByFloorAndArea = (lights) => {
      const groups = {}; // { floorName: { level, areas: { areaName: [entityIds] } } }

      lights.forEach(id => {
        const areaId = getAreaId(id);
        const floorName = areaId ? getFloorName(areaId) : 'Sonstige';
        const floorLevel = areaId ? getFloorLevel(areaId) : 999;
        const areaName = areaId ? getAreaName(areaId) : 'Kein Bereich';

        if (!groups[floorName]) {
          groups[floorName] = { level: floorLevel, areas: {} };
        }
        if (!groups[floorName].areas[areaName]) {
          groups[floorName].areas[areaName] = [];
        }
        groups[floorName].areas[areaName].push(id);
      });

      return groups;
    };

    // Baue Sections für einen Status-Block (on/off)
    const buildSections = (lights, statusLabel, statusIcon) => {
      const sections = [];

      // Heading für Status-Gruppe
      sections.push({
        type: "grid",
        cards: [{
          type: "heading",
          heading: `${statusLabel} (${lights.length})`,
          heading_style: "title",
          icon: statusIcon
        }]
      });

      if (lights.length === 0) {
        sections.push({
          type: "grid",
          cards: [{ type: "markdown", content: `Keine ${statusLabel.toLowerCase()}.` }]
        });
        return sections;
      }

      const groups = groupByFloorAndArea(lights);

      // Sortiere Etagen nach Level
      const sortedFloors = Object.entries(groups)
        .sort((a, b) => a[1].level - b[1].level);

      sortedFloors.forEach(([floorName, floorData]) => {
        // Sortiere Räume alphabetisch
        const sortedAreas = Object.entries(floorData.areas)
          .sort((a, b) => a[0].localeCompare(b[0]));

        sortedAreas.forEach(([areaName, entityIds]) => {
          const cards = [
            {
              type: "heading",
              heading: `${floorName} · ${areaName}`,
              heading_style: "subtitle",
              icon: "mdi:floor-plan"
            },
            ...entityIds.map(id => ({
              type: "tile",
              entity: id,
              state_color: true,
              features: [{ type: "light-brightness" }],
              features_position: "inline",
              vertical: false
            }))
          ];

          sections.push({ type: "grid", cards });
        });
      });

      return sections;
    };

    // Alle Sections zusammenbauen
    const allSections = [
      ...buildSections(onLights, 'Eingeschaltete Lichter', 'mdi:lightbulb-on'),
      ...buildSections(offLights, 'Ausgeschaltete Lichter', 'mdi:lightbulb-off')
    ];

    return {
      type: "sections",
      sections: allSections
    };
  }
}

customElements.define("ll-strategy-simon42-view-lights", Simon42ViewLightsStrategy);
console.log('✅ Simon42 View Lights Strategy (grouped by floor/area) loaded');
