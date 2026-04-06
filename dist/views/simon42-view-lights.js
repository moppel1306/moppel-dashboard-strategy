// ====================================================================
// VIEW STRATEGY - LICHTER (gruppiert nach Etage → Raum → Status)
// ====================================================================
class Simon42ViewLightsStrategy {
  static async generate(config, hass) {

    const allLights = Object.keys(hass.states).filter(id => {
      if (!id.startsWith('light.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      const reg = (hass.entities || {})[id];
      if (reg && reg.hidden === true) return false;
      const attrs = state.attributes || {};
      if (attrs.entity_category === 'config') return false;
      if (attrs.entity_category === 'diagnostic') return false;
      return true;
    });

    const getAreaId = (entityId) => {
      const entities = hass.entities || {};
      const devices = hass.devices || {};
      const reg = entities[entityId];
      if (reg && reg.area_id) return reg.area_id;
      if (reg && reg.device_id && devices[reg.device_id]) {
        return devices[reg.device_id].area_id || null;
      }
      return null;
    };

    const getFloorName = (areaId) => {
      const areas = hass.areas || {};
      const floors = hass.floors || {};
      const area = areas[areaId];
      if (!area || !area.floor_id) return 'Sonstige';
      const floor = floors[area.floor_id];
      return floor ? floor.name : 'Sonstige';
    };

    const getFloorLevel = (areaId) => {
      const areas = hass.areas || {};
      const floors = hass.floors || {};
      const area = areas[areaId];
      if (!area || !area.floor_id) return 999;
      const floor = floors[area.floor_id];
      return floor && floor.level != null ? floor.level : 999;
    };

    const getAreaName = (areaId) => {
      const areas = hass.areas || {};
      return areas[areaId] ? areas[areaId].name : areaId;
    };

    const onLights  = allLights.filter(id => hass.states[id] && hass.states[id].state === 'on');
    const offLights = allLights.filter(id => !hass.states[id] || hass.states[id].state !== 'on');

    const groupByFloorAndArea = (lights) => {
      const groups = {};
      lights.forEach(id => {
        const areaId    = getAreaId(id);
        const floorName = areaId ? getFloorName(areaId) : 'Sonstige';
        const floorLvl  = areaId ? getFloorLevel(areaId) : 999;
        const areaName  = areaId ? getAreaName(areaId) : 'Kein Bereich';
        if (!groups[floorName]) groups[floorName] = { level: floorLvl, areas: {} };
        if (!groups[floorName].areas[areaName]) groups[floorName].areas[areaName] = [];
        groups[floorName].areas[areaName].push(id);
      });
      return groups;
    };

    const buildSections = (lights, label, icon, service) => {
      const sections = [];

      // Heading + "Alle" Button nebeneinander
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `${label} (${lights.length})`,
            heading_style: "title",
            icon
          },
          {
            type: "button",
            name: service === 'light.turn_off' ? 'Alle ausschalten' : 'Alle einschalten',
            icon: service === 'light.turn_off' ? 'mdi:lightbulb-off' : 'mdi:lightbulb-on',
            tap_action: {
              action: "call-service",
              service,
              target: { entity_id: lights }
            }
          }
        ]
      });

      if (lights.length === 0) {
        sections.push({ type: "grid", cards: [{ type: "markdown", content: `Keine ${label.toLowerCase()}.` }] });
        return sections;
      }

      const groups = groupByFloorAndArea(lights);

      // Sortiere Etagen alphabetisch nach Name
      const sortedFloors = Object.entries(groups)
        .sort((a, b) => a[0].localeCompare(b[0], 'de'));

      sortedFloors.forEach(([floorName, floorData]) => {
        const sortedAreas = Object.entries(floorData.areas)
          .sort((a, b) => a[0].localeCompare(b[0], 'de'));

        sortedAreas.forEach(([areaName, ids]) => {
          sections.push({
            type: "grid",
            cards: [
              {
                type: "heading",
                heading: `${floorName} · ${areaName}`,
                heading_style: "subtitle",
                icon: "mdi:floor-plan"
              },
              ...ids.map(id => ({
                type: "tile",
                entity: id,
                state_color: true,
                features: [{ type: "light-brightness" }],
                features_position: "inline",
                vertical: false
              }))
            ]
          });
        });
      });

      return sections;
    };

    return {
      type: "sections",
      sections: [
        ...buildSections(onLights,  'Eingeschaltete Lichter', 'mdi:lightbulb-on',  'light.turn_off'),
        ...buildSections(offLights, 'Ausgeschaltete Lichter', 'mdi:lightbulb-off', 'light.turn_on')
      ]
    };
  }
}

customElements.define("ll-strategy-simon42-view-lights", Simon42ViewLightsStrategy);
console.log('✅ Simon42 View Lights Strategy loaded');
