class Simon42ViewMotionStrategy {
  static async generate(config, hass) {
    const allEntityIds = Object.keys(hass.states);

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

    const motionEntities = allEntityIds.filter(id => {
      if (!id.startsWith('binary_sensor.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      if (state.attributes?.device_class !== 'motion') return false;
      const registryEntry = (hass.entities || {})[id];
      if (registryEntry?.hidden === true) return false;
      if (state.attributes?.entity_category === 'config') return false;
      if (state.attributes?.entity_category === 'diagnostic') return false;
      return true;
    });

    const active   = motionEntities.filter(id => hass.states[id]?.state === 'on');
    const inactive = motionEntities.filter(id => hass.states[id]?.state !== 'on');

    const tileMapper = id => ({ type: "tile", entity: id, state_color: true });

    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: [
            { type: "heading", heading: `Bewegung erkannt (${active.length})`, heading_style: "title", icon: "mdi:motion-sensor" },
            ...(active.length > 0 ? withAreaGroups(active, tileMapper) : [{ type: "markdown", content: "Keine Bewegung wird gerade erkannt." }])
          ]
        },
        {
          type: "grid",
          cards: [
            { type: "heading", heading: `Keine Bewegung (${inactive.length})`, heading_style: "title", icon: "mdi:motion-sensor-off" },
            ...(inactive.length > 0 ? withAreaGroups(inactive, tileMapper) : [{ type: "markdown", content: "Alle Sensoren aktiv." }])
          ]
        }
      ]
    };
  }
}

customElements.define("ll-strategy-moppel1306-view-motion", Simon42ViewMotionStrategy);
console.log('✅ Simon42 View Motion Strategy loaded');
