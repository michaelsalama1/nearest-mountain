// Background service worker for the Nearest Mountain extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Nearest Mountain extension installed');
    
    // Set up context menu
    chrome.contextMenus.create({
        id: 'findNearestMountain',
        title: 'Find Nearest Mountain',
        contexts: ['page']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'findNearestMountain') {
        // Send message to content script to find nearest mountain
        chrome.tabs.sendMessage(tab.id, {
            action: 'findNearestMountain'
        });
    }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getUserLocation') {
        // Handle location request
        navigator.geolocation.getCurrentPosition(
            (position) => {
                sendResponse({
                    success: true,
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                });
            },
            (error) => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        );
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'openMaps') {
        // Open Google Maps with coordinates
        const url = `https://www.google.com/maps?q=${request.lat},${request.lng}`;
        chrome.tabs.create({ url });
        sendResponse({ success: true });
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will only trigger if no popup is defined
    // Since we have a popup, this won't be called
    console.log('Extension icon clicked');
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // You could inject content scripts or perform actions when pages load
        console.log('Tab updated:', tab.url);
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Nearest Mountain extension started');
});
