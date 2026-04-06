// ====================================================================
// VIEW STRATEGY - LICHTER (1-spaltig, nach Dashboard-Reihenfolge)
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

    const buildCards = (lights, label, icon, service) => {
      const cards = [];

      // Status-Heading mit Button rechts
      cards.push({
        type: "heading",
        heading: `${label} (${lights.length})`,
        heading_style: "title",
        icon,
        badges: [
          {
            type: "button",
            label: service === 'light.turn_off' ? 'Alle ausschalten' : 'Alle einschalten',
            tap_action: {
              action: "call-service",
              service,
              target: { entity_id: lights.length > 0 ? lights : [] }
            }
          }
        ]
      });

      if (lights.length === 0) {
        cards.push({ type: "markdown", content: `Keine ${label.toLowerCase()}.` });
        return cards;
      }

      const groups = groupByArea(lights);
      groups.forEach(({ areaId, lights: areaLights }) => {
        const areaName = areaId === '__none__' ? 'Kein Bereich' : getAreaName(areaId);

        cards.push({
          type: "heading",
          heading: areaName,
          heading_style: "subtitle",
          icon: "mdi:floor-plan"
        });

        areaLights.forEach(id => {
          cards.push({
            type: "tile",
            entity: id,
            state_color: true,
            features: [{ type: "light-brightness" }],
            features_position: "inline",
            vertical: false
          });
        });
      });

      return cards;
    };

    const allCards = [
      ...buildCards(onLights,  'Eingeschaltete Lichter', 'mdi:lightbulb-on',  'light.turn_off'),
      ...buildCards(offLights, 'Ausgeschaltete Lichter', 'mdi:lightbulb-off', 'light.turn_on')
    ];

    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: allCards
        }
      ]
    };
  }
}

customElements.define("ll-strategy-simon42-view-lights", Simon42ViewLightsStrategy);
console.log('✅ Simon42 View Lights Strategy loaded');
