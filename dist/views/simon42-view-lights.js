// ====================================================================
// VIEW STRATEGY - LICHTER - MIT REAKTIVEN GROUP-CARDS
// ====================================================================
import { getExcludedLabels } from '../utils/simon42-helpers.js';
class Simon42ViewLightsStrategy {
  static async generate(config, hass) {
    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: [
            {
              type: "custom:simon42-lights-group-card",
              entities: config.entities,
              config: config.config,
              group_type: "on"
            },
            {
              type: "custom:simon42-lights-group-card",
              entities: config.entities,
              config: config.config,
              group_type: "off"
            }
          ]
        }
      ]
    };
  }
}
customElements.define("ll-strategy-simon42-view-lights", Simon42ViewLightsStrategy);
console.log('✅ Simon42 View Lights Strategy loaded');
