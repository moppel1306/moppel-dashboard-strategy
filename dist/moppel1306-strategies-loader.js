// ====================================================================
// SIMON42 DASHBOARD STRATEGIES - LOADER (MIT REAKTIVEN GROUP-CARDS)
// ====================================================================
// Diese Datei lädt alle Strategy-Module inklusive der neuen reaktiven
// Lights Group Cards
// 
// Installation in Home Assistant:
// 1. Alle Dateien in /config/www/moppel1306-strategy/ speichern
// 2. In configuration.yaml hinzufügen:
//    lovelace:
//      resources:
//        - url: /local/moppel1306-strategy/moppel1306-strategies-loader.js
//          type: module
// 3. Home Assistant neu starten
// 
// Verwendung im Dashboard:
// strategy:
//   type: custom:moppel1306-dashboard
// ====================================================================

// Lade Helper-Funktionen
import './utils/moppel1306-helpers.js';
import './utils/moppel1306-data-collectors.js';
import './utils/moppel1306-badge-builder.js';
import './utils/moppel1306-section-builder.js';
import './utils/moppel1306-view-builder.js';

// Lade Custom Cards
import './cards/moppel1306-summary-card.js';
import './cards/moppel1306-lights-group-card.js'; // NEU: Reaktive Lights Group Card
import './cards/moppel1306-covers-group-card.js'; // NEU: Reaktive Covers Group Card

// Lade Core-Module
import './core/moppel1306-dashboard-strategy.js';

// Lade View-Module
import './views/moppel1306-view-room.js';
import './views/moppel1306-view-lights.js'; // Nutzt jetzt die reaktiven Group-Cards
import './views/moppel1306-view-covers.js';
import './views/moppel1306-view-security.js';
import './views/moppel1306-view-batteries.js';
import './views/moppel1306-view-motion.js';
import './views/moppel1306-view-co2.js';
import './views/moppel1306-view-climate.js';

console.log('Simon42 Dashboard Strategies loaded successfully (with reactive lights + covers cards + climate)!');
