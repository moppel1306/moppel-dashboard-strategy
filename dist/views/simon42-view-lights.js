// ====================================================================
// VIEW STRATEGY - LICHTER (gruppiert nach Dashboard-Reihenfolge)
// ====================================================================
class Simon42ViewLightsStrategy {
  static async generate(config, hass) {

    const dashboardConfig = config.config || {};
    const areaOrder = dashboardConfig.areas_display?.order || [];
    const hiddenAreas = dashboardConfig.areas_display?.hidden || [];

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

    const getAreaName = (areaId) => {
      return (hass.areas || {})[areaId]?.name || areaId;
    };

    const onLights  = allLights.filter(id => hass.states[id]?.state === 'on');
    const offLights = allLights.filter(id => !hass.states[id] || hass.states[id].state !== 'on');

    // Gruppiere nach Area in Dashboard-Reihenfolge
    const groupByArea = (lights) => {
      const byArea = {};
      lights.forEach(id => {
        const areaId = getAreaId(id) || '__none__';
        if (!byArea[areaId]) byArea[areaId] = [];
        byArea[areaId].push(id);
      });

      const allAreaIds = Object.keys(hass.areas || {});
      const ordered = [
        ...areaOrder.filter(id => allAreaIds.includes(id) && !hiddenAreas.includes(id)),
        ...allAreaIds.filter(id => !areaOrder.includes(id) && !hiddenAreas.includes(id))
      ];

      const result = [];
      ordered.forEach(areaId => {
        if (byArea[areaId]) result.push({ areaId, lights: byArea[areaId] });
      });
      if (byArea['__none__']) result.push({ areaId: '__none__', lights: byArea['__none__'] });
      return result;
    };

    const buildSections = (lights, label, icon, service) => {
      const sections = [];

      // Status-Heading in eigener Section
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `${label} (${lights.length})`,
            heading_style: "title",
            icon
          }
        ]
      });

      // "Alle"-Button in eigener Section
      sections.push({
        type: "grid",
        cards: [
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
        sections.push({
          type: "grid",
          cards: [{ type: "markdown", content: `Keine ${label.toLowerCase()}.` }]
        });
        return sections;
      }

      const groups = groupByArea(lights);
      groups.forEach(({ areaId, lights: areaLights }) => {
        const areaName = areaId === '__none__' ? 'Kein Bereich' : getAreaName(areaId);
        sections.push({
          type: "grid",
          cards: [
            {
              type: "heading",
              heading: areaName,
              heading_style: "subtitle",
              icon: "mdi:floor-plan"
            },
            ...areaLights.map(id => ({
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
