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

    const active   = motionEntities.filter(id => hass.states[id]?.state === 'on');
    const inactive = motionEntities.filter(id => hass.states[id]?.state !== 'on');

    const activeCards = active.map(id => ({
      type: 'tile',
      entity: id,
      state_color: true
    }));

    const inactiveCards = inactive.map(id => ({
      type: 'tile',
      entity: id,
      state_color: true
    }));

    const sections = [];

    // Aktive Sensoren
    sections.push({
      type: "grid",
      cards: [
        {
          type: "heading",
          heading: `Bewegung erkannt (${active.length})`,
          icon: "mdi:motion-sensor",
          heading_style: "title"
        },
        ...(activeCards.length > 0 ? activeCards : [{
          type: "markdown",
          content: "Keine Bewegung wird gerade erkannt."
        }])
      ]
    });

    // Inaktive Sensoren
    sections.push({
      type: "grid",
      cards: [
        {
          type: "heading",
          heading: `Keine Bewegung (${inactive.length})`,
          icon: "mdi:motion-sensor-off",
          heading_style: "title"
        },
        ...(inactiveCards.length > 0 ? inactiveCards : [{
          type: "markdown",
          content: "Alle Sensoren aktiv."
        }])
      ]
    });

    return {
      type: "sections",
      sections
    };
  }
}

customElements.define("ll-strategy-simon42-view-motion", Simon42ViewMotionStrategy);
console.log('✅ Simon42 View Motion Strategy loaded');
