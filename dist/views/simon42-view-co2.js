// ====================================================================
// VIEW STRATEGY - CO2 SENSOREN
// ====================================================================
class Simon42ViewCO2Strategy {
  static async generate(config, hass) {
    const allEntityIds = Object.keys(hass.states);

    const co2Entities = allEntityIds.filter(id => {
      if (!id.startsWith('sensor.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      if (state.attributes?.device_class !== 'carbon_dioxide') return false;
      const registryEntry = hass.entities?.[id];
      if (registryEntry?.hidden === true) return false;
      if (state.attributes?.entity_category === 'config') return false;
      if (state.attributes?.entity_category === 'diagnostic') return false;
      return true;
    });

    // Sortiere nach Wert absteigend
    co2Entities.sort((a, b) => {
      const valA = parseFloat(hass.states[a]?.state) || 0;
      const valB = parseFloat(hass.states[b]?.state) || 0;
      return valB - valA;
    });

    const critical = co2Entities.filter(id => parseFloat(hass.states[id]?.state) >= 1400);
    const moderate = co2Entities.filter(id => {
      const v = parseFloat(hass.states[id]?.state);
      return v >= 800 && v < 1400;
    });
    const good = co2Entities.filter(id => parseFloat(hass.states[id]?.state) < 800);

    const makeCards = (entities) => entities.map(id => ({
      type: "tile",
      entity: id,
      state_color: true
    }));

    const sections = [
      {
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🔴 Kritisch — über 1400 ppm (${critical.length})`,
            heading_style: "title",
            icon: "mdi:molecule-co2"
          },
          ...(critical.length > 0 ? makeCards(critical) : [{ type: "markdown", content: "Keine Räume über 1400 ppm ✅" }])
        ]
      },
      {
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🟡 Mäßig — 800 bis 1400 ppm (${moderate.length})`,
            heading_style: "title",
            icon: "mdi:air-filter"
          },
          ...(moderate.length > 0 ? makeCards(moderate) : [{ type: "markdown", content: "Keine Räume in diesem Bereich." }])
        ]
      },
      {
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: `🟢 Gut — unter 800 ppm (${good.length})`,
            heading_style: "title",
            icon: "mdi:leaf"
          },
          ...(good.length > 0 ? makeCards(good) : [{ type: "markdown", content: "Keine Räume in diesem Bereich." }])
        ]
      }
    ];

    return { type: "sections", sections };
  }
}

customElements.define("ll-strategy-simon42-view-co2", Simon42ViewCO2Strategy);
console.log('✅ Simon42 View CO2 Strategy loaded');
