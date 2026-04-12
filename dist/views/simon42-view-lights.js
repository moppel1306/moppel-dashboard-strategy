// ====================================================================
// VIEW STRATEGY - LICHTER - MIT REAKTIVEN GROUP-CARDS
// ====================================================================
import { getExcludedLabels } from '../utils/moppel1306-helpers.js';
class Simon42ViewLightsStrategy {
  static async generate(config, hass) {
    return {
      type: "sections",
      sections: [
        {
          type: "grid",
          cards: [
            {
              type: "custom:moppel1306-lights-group-card",
              entities: config.entities,
              config: config.config,
              group_type: "on"
            },
            {
              type: "custom:moppel1306-lights-group-card",
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
customElements.define("ll-strategy-moppel1306-view-lights", Simon42ViewLightsStrategy);
console.log('✅ Simon42 View Lights Strategy loaded');
