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
