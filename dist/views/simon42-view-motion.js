// ====================================================================
// VIEW STRATEGY - BEWEGUNGSMELDER
// ====================================================================
class Simon42ViewMotionStrategy {
  static async generate(config, hass) {
    const allEntityIds = Object.keys(hass.states);
    
    // Alle Bewegungsmelder filtern
    const motionEntities = allEntityIds.filter(id => {
      if (!id.startsWith('binary_sensor.')) return false;
      const state = hass.states[id];
      if (!state) return false;
      if (state.attributes?.device_class !== 'motion') return false;
      const registryEntry = hass.entities?.[id];
      if (registryEntry?.hidden === true) return false;
      if (state.attributes?.entity_category === 'config') return false;
      if (state.attributes?.entity_category === 'diagnostic') return false;
      return true;
    });

    // Aktive zuerst, dann inaktive
    const active = motionEntities.filter(id => hass.states[id]?.state === 'on');
    const inactive = motionEntities.filter(id => hass.states[id]?.state !== 'on');
    const sorted = [...active, ...inactive];

    const cards = sorted.map(id => ({
      type: 'tile',
      entity: id,
      state_color: true
    }));

    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: [
            {
              type: "heading",
              heading: "Bewegungsmelder",
              icon: "mdi:motion-sensor"
            },
            ...cards
          ]
        }
      ]
    };
  }
}

customElements.define("ll-strategy-simon42-view-motion", Simon42ViewMotionStrategy);
console.log('✅ Simon42 View Motion Strategy loaded');
