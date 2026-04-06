// ====================================================================
// SIMON42 LIGHTS GROUP CARD - Mit Area-Gruppierung
// ====================================================================
class Simon42LightsGroupCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entities = null;
    this._excludeSet = new Set();
    this._hiddenFromConfigSet = new Set();
    this._lastLightsList = '';
  }

  setConfig(config) {
    if (!config.entities) throw new Error("You need to define entities");
    if (!config.group_type) throw new Error("You need to define group_type (on/off)");
    this._config = config;
    this._entities = config.entities;
    this._calculateExcludeSets();
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    if (!oldHass || oldHass.entities !== hass.entities) {
      this._calculateExcludeSets();
    }
    const currentLights = this._getRelevantLights();
    const lightsKey = currentLights.join(',');
    if (!oldHass || this._lastLightsList !== lightsKey) {
      this._lastLightsList = lightsKey;
      this._render();
    }
  }

  _calculateExcludeSets() {
    this._excludeSet = new Set();
    this._entities.forEach(e => {
      if (e.labels?.includes("no_dboard")) this._excludeSet.add(e.entity_id);
    });
    this._hiddenFromConfigSet = new Set();
    if (this._config.config?.areas_options) {
      for (const areaOptions of Object.values(this._config.config.areas_options)) {
        if (areaOptions.groups_options?.lights?.hidden) {
          areaOptions.groups_options.lights.hidden.forEach(id => this._hiddenFromConfigSet.add(id));
        }
      }
    }
  }

  _getFilteredLightEntities() {
    if (!this._hass) return [];
    return this._entities
      .filter(e => {
        const id = e.entity_id;
        if (!id.startsWith('light.')) return false;
        if (e.hidden === true || e.hidden_by || e.disabled_by) return false;
        if (e.entity_category === 'config' || e.entity_category === 'diagnostic') return false;
        if (this._hass.states[id] === undefined) return false;
        if (this._excludeSet.has(id)) return false;
        if (this._hiddenFromConfigSet.has(id)) return false;
        return true;
      })
      .map(e => e.entity_id);
  }

  _getRelevantLights() {
    const allLights = this._getFilteredLightEntities();
    const targetState = this._config.group_type === 'on' ? 'on' : 'off';
    const relevantLights = allLights.filter(id => {
      const state = this._hass.states[id];
      return state && state.state === targetState;
    });
    relevantLights.sort((a, b) => {
      const stateA = this._hass.states[a];
      const stateB = this._hass.states[b];
      if (!stateA || !stateB) return 0;
      return new Date(stateB.last_changed) - new Date(stateA.last_changed);
    });
    return relevantLights;
  }

  _getAreaName(entityId) {
    const reg = this._entities.find(e => e.entity_id === entityId);
    if (!reg) return null;
    const areaId = reg.area_id || (reg.device_id ? (this._hass.devices?.[reg.device_id]?.area_id) : null);
    if (!areaId) return null;
    return this._hass.areas?.[areaId]?.name || null;
  }

  _groupByArea(lights) {
    // Dashboard-Reihenfolge aus config
    const areaOrder = this._config.config?.areas_display?.order || [];
    const hiddenAreas = this._config.config?.areas_display?.hidden || [];
    const allAreaIds = Object.keys(this._hass.areas || {});
    const ordered = [
      ...areaOrder.filter(id => allAreaIds.includes(id) && !hiddenAreas.includes(id)),
      ...allAreaIds.filter(id => !areaOrder.includes(id) && !hiddenAreas.includes(id))
    ];

    const byArea = {};
    lights.forEach(id => {
      const areaName = this._getAreaName(id) || '__none__';
      if (!byArea[areaName]) byArea[areaName] = [];
      byArea[areaName].push(id);
    });

    // Sortiere nach Dashboard-Reihenfolge
    const result = [];
    const areaNameToId = {};
    allAreaIds.forEach(id => {
      const name = this._hass.areas[id]?.name;
      if (name) areaNameToId[name] = id;
    });

    ordered.forEach(areaId => {
      const areaName = this._hass.areas?.[areaId]?.name;
      if (areaName && byArea[areaName]) {
        result.push({ name: areaName, lights: byArea[areaName] });
        delete byArea[areaName];
      }
    });

    // Rest alphabetisch
    Object.keys(byArea).sort().forEach(name => {
      if (name !== '__none__') result.push({ name, lights: byArea[name] });
    });
    if (byArea['__none__']) result.push({ name: null, lights: byArea['__none__'] });

    return result;
  }

  _render() {
    if (!this._hass) return;
    const lights = this._getRelevantLights();
    const isOn = this._config.group_type === 'on';

    if (lights.length === 0) {
      this.style.display = 'none';
      return;
    }
    this.style.display = 'block';

    const icon = isOn ? '💡' : '🌙';
    const title = isOn ? 'Eingeschaltete Lichter' : 'Ausgeschaltete Lichter';
    const actionIcon = isOn ? 'mdi:lightbulb-off' : 'mdi:lightbulb-on';
    const actionService = isOn ? 'turn_off' : 'turn_on';
    const groups = this._groupByArea(lights);

    // Baue Gruppen-HTML
    let groupsHTML = '';
    groups.forEach(({ name, lights: groupLights }) => {
      groupsHTML += `
        ${name ? `<div class="area-heading">${name}</div>` : ''}
        <div class="light-grid" data-group="${name || 'none'}"></div>
      `;
    });

    this.innerHTML = `
      <style>
        .lights-section { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .section-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
        .section-heading { font-size: ${isOn ? '20px' : '16px'}; font-weight: ${isOn ? '500' : '400'}; margin: 0; display: flex; align-items: center; gap: 8px; }
        .batch-button { padding: 8px 12px; border-radius: 18px; background: var(--primary-color); color: var(--text-primary-color); border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 14px; }
        .batch-button:hover { background: var(--primary-color-dark); }
        .batch-button ha-icon { --mdc-icon-size: 18px; }
        .area-heading { font-size: 13px; font-weight: 500; color: var(--secondary-text-color); padding: 8px 4px 4px 4px; display: flex; align-items: center; gap: 6px; }
        .area-heading::before { content: ''; display: inline-block; width: 16px; height: 16px; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M3 6v14h8v-7h2v7h8V6l-9-4z'/%3E%3C/svg%3E") center/contain no-repeat; }
        .light-grid { display: flex; flex-direction: column; gap: 8px; }
      </style>
      <div class="lights-section">
        <div class="section-header">
          <h${isOn ? '2' : '3'} class="section-heading">
            ${icon} ${title} (${lights.length})
          </h${isOn ? '2' : '3'}>
          <button class="batch-button" id="batch-action">
            <ha-icon icon="${actionIcon}"></ha-icon>
            Alle ${isOn ? 'ausschalten' : 'einschalten'}
          </button>
        </div>
        ${groupsHTML}
      </div>
    `;

    // Batch-Button
    this.querySelector('#batch-action')?.addEventListener('click', () => {
      this._hass.callService('light', actionService, { entity_id: lights });
    });

    // Tile-Cards in die richtigen Gruppen einfügen
    const grids = this.querySelectorAll('.light-grid');
    groups.forEach(({ name, lights: groupLights }, i) => {
      const grid = grids[i];
      if (!grid) return;
      groupLights.forEach(entityId => {
        const card = document.createElement('hui-tile-card');
        card.hass = this._hass;
        const cardConfig = {
          type: 'tile',
          entity: entityId,
          vertical: false,
          state_content: 'last_changed'
        };
        if (isOn) {
          cardConfig.features = [{ type: 'light-brightness' }];
          cardConfig.features_position = 'inline';
        }
        card.setConfig(cardConfig);
        grid.appendChild(card);
      });
    });
  }

  getCardSize() {
    return Math.ceil(this._getRelevantLights().length / 3) + 1;
  }
}

customElements.define("simon42-lights-group-card", Simon42LightsGroupCard);
console.log('✅ Simon42 Lights Group Card loaded');
