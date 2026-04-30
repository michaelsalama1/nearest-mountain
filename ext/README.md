# NearestMountain Chrome Extension

A Chrome extension that automatically extracts coordinates from URLs and fetches mountain data directly from the nearestmountain.com API.

## Features

- 🏔️ **Automatic Operation**: No buttons needed - works immediately when activated
- 📍 **URL Parsing**: Uses regex to locate coordinates in format `@lat,lng,`
- 🌐 **Direct API Integration**: Calls nearestmountain.com API directly for real-time data
- ⚡ **Instant Results**: Coordinates are extracted and mountain data fetched automatically
- 🎨 **Clean Interface**: Simple, focused design that displays mountain information
- 📊 **Rich Data**: Shows mountain names, distances, elevations, and ranges

## How It Works

The extension automatically:
1. **Extracts coordinates** from the current page URL when activated
2. **Looks for the pattern** `@11.6748553,37.5709485,` in URLs
3. **Calls the API** directly: `https://www.nearestmountain.com/api/nearestMountain?lat=11.6748553&lon=37.5709485&minElevation=500`
4. **Displays results** in the popup with mountain names, distances, and elevations

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right corner
4. **Click "Load unpacked"** and select the `ext` folder from this project
5. **Pin the extension** to your toolbar for easy access

### Method 2: Create Icon Files

Before loading the extension, you'll need to create actual PNG icon files:

- `icons/mtn.png` (your mountain icon file)

## Usage

1. **Navigate to a page** with coordinates in the URL (e.g., Google Maps with coordinates)
2. **Click the extension icon** in your Chrome toolbar
3. **Extension automatically**:
   - Extracts coordinates from the URL
   - Shows the found coordinates
   - Fetches mountain data from the API
   - Displays mountain information in the popup

**That's it!** No clicking, no waiting, no manual steps.

## API Integration

The extension calls the nearestmountain.com API endpoint:
```
GET /api/nearestMountain?lat={latitude}&lon={longitude}&minElevation=500
```

**Response includes:**
- Mountain names
- Distances from coordinates
- Elevation ranges (low/high)
- Mountain ranges
- Countries and regions

## URL Format Support

The extension recognizes coordinates in these formats:
- `@11.6748553,37.5709485,` (Google Maps format)
- `@-33.8568,151.2153,` (Negative coordinates supported)
- `@0.0000,0.0000,` (Decimal precision supported)

## Technical Details

- **Manifest Version**: 3 (Latest Chrome extension standard)
- **Permissions**: 
  - `tabs`: Access to tab URLs
  - `activeTab`: Access to current tab
- **Content Scripts**: Runs on all websites
- **Background Service Worker**: Handles extension lifecycle and messaging
- **Popup Interface**: Minimal interface that displays API results
- **API Integration**: Direct calls to nearestmountain.com backend

## File Structure

```
ext/
├── manifest.json          # Extension configuration
├── popup.html            # Mountain data display interface
├── popup.css             # Clean, focused styling
├── popup.js              # API integration and coordinate extraction
├── background.js         # Background service worker
├── content.js            # Content script for web pages
├── icons/                # Extension icons
│   └── mtn.png          # Mountain icon
└── README.md             # This file
```

## Development

### Customizing Coordinate Extraction

To modify the coordinate regex pattern, edit the `coordinateRegex` in `popup.js`:

```javascript
const coordinateRegex = /@(-?\d+\.\d+),(-?\d+\.\d+),/;
```

### Customizing the API Call

To change the API endpoint or parameters, modify the `fetchMountainData` function in `popup.js`:

```javascript
const response = await fetch(`https://www.nearestmountain.com/api/nearestMountain?lat=${lat}&lon=${lng}&minElevation=500`);
```

### Adding Features

- **Multiple API Endpoints**: Support for different mountain data sources
- **Data Caching**: Store results locally for offline use
- **Advanced Filtering**: Filter by elevation, distance, or mountain type
- **Interactive Maps**: Show mountains on a mini map in the popup

## Troubleshooting

### No Coordinates Found
- Ensure the URL contains coordinates in the format `@lat,lng,`
- Check that the coordinates are decimal numbers
- Verify the extension has permission to access tab URLs

### API Errors
- Check if nearestmountain.com is accessible
- Verify the API endpoint is working
- Check browser console for error details

### Extension Won't Load
- Verify all required files are present
- Check that icon files are actual PNG images
- Ensure manifest.json is valid JSON

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3 support)
- **Edge**: 88+ (Chromium-based)
- **Opera**: 74+ (Chromium-based)
- **Firefox**: Not supported (different extension system)

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension!

---

**Note**: This extension integrates directly with the nearestmountain.com API for real-time mountain data. For production use, consider:
- Adding API rate limiting
- Implementing data caching
- Adding error handling for API failures
- Adding unit tests for API integration
- Adding accessibility features
