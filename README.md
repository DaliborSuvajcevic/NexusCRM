# PRODUCT LAB · CRM

Client pipeline for AI Product Lab (The Golden Circle). Static site, no build step, no backend.

## Stages
New inquiry → In conversation → Brief received → In production → Delivered → Paid / Lost

## Data
- Stored only in this browser's `localStorage` under `plcrm.v1.leads`.
- Use **Export backup** regularly (JSON). **Import backup** replaces current data.
- Old NexusCRM data (key `leads`) is moved over automatically on first open.

## Files
`index.html`, `style.css`, `script.js`, `i18n.js` (SR default, EN switch), `assets/` (original crown from Product Lab).
