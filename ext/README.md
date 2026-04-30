# NearestMountain Chrome Extension

Small Chrome extension that reads coordinates from the current Google Maps URL and fetches nearby mountain data from nearestmountain.com.

## Setup
1. Open `chrome://extensions/`
2. Turn on Developer mode
3. Click Load unpacked
4. Select this `ext` folder

## Usage
1. Navigate to a desired location in Google Maps. The extension searches for coordinates in the URL.
2. Click the extension icon
3. It extracts coords and calls:
   `https://www.nearestmountain.com/api/nearestMountain?lat={lat}&lon={lon}&minElevation=500`
4. Popup shows name, distance, range, and elevation

## Notes
- Regex pattern in `popup.js`: `/@(-?\d+\.\d+),(-?\d+\.\d+),/`
- Manifest version: 3
- Main files: `manifest.json`, `popup.js`, `popup.html`, `background.js`, `content.js`
