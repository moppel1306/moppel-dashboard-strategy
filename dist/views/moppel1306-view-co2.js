class Simon42ViewCO2Strategy {
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

    const co2Entities = allEntityIds.filter(id => {
      if (!id.startsWith('sensor.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      if (state.attributes?.device_class !== 'carbon_dioxide') return false;
      const reg = (hass.entities || {})[id];
      if (reg?.hidden === true) return false;
      if (state.attributes?.entity_category === 'config') return false;
      if (state.attributes?.entity_category === 'diagnostic') return false;
      return true;
    });

    const critical = co2Entities.filter(id => parseFloat(hass.states[id]?.state) >= 1400);
    const moderate = co2Entities.filter(id => { const v = parseFloat(hass.states[id]?.state); return v >= 800 && v < 1400; });
    const good     = co2Entities.filter(id => parseFloat(hass.states[id]?.state) < 800);

    const tileMapper = id => ({ type: "tile", entity: id, state_color: true });

    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: [
            { type: "heading", heading: `🔴 Kritisch — über 1400 ppm (${critical.length})`, heading_style: "title", icon: "mdi:molecule-co2" },
            ...(critical.length > 0 ? withAreaGroups(critical, tileMapper) : [{ type: "markdown", content: "Keine Räume über 1400 ppm ✅" }])
          ]
        },
        {
          type: "grid",
          cards: [
            { type: "heading", heading: `🟡 Mäßig — 800 bis 1400 ppm (${moderate.length})`, heading_style: "title", icon: "mdi:air-filter" },
            ...(moderate.length > 0 ? withAreaGroups(moderate, tileMapper) : [{ type: "markdown", content: "Keine Räume in diesem Bereich." }])
          ]
        },
        {
          type: "grid",
          cards: [
            { type: "heading", heading: `🟢 Gut — unter 800 ppm (${good.length})`, heading_style: "title", icon: "mdi:leaf" },
            ...(good.length > 0 ? withAreaGroups(good, tileMapper) : [{ type: "markdown", content: "Keine Räume in diesem Bereich." }])
          ]
        }
      ]
    };
  }
}

customElements.define("ll-strategy-moppel1306-view-co2", Simon42ViewCO2Strategy);
console.log('✅ Simon42 View CO2 Strategy loaded');
