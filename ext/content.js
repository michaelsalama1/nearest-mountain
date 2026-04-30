// Content script for the Nearest Mountain extension

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'findNearestMountain') {
        // This could be enhanced to work with the current page content
        showMountainNotification();
        sendResponse({ success: true });
    }
});

// Show a notification about the extension
function showMountainNotification() {
    // Create a notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        cursor: pointer;
        transition: transform 0.2s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🏔️</span>
            <div>
                <div style="font-weight: 600; margin-bottom: 5px;">Nearest Mountain Extension</div>
                <div style="font-size: 12px; opacity: 0.9;">Click the extension icon to find nearby mountains!</div>
            </div>
        </div>
    `;
    
    // Add hover effect
    notification.addEventListener('mouseenter', () => {
        notification.style.transform = 'translateY(-2px)';
    });
    
    notification.addEventListener('mouseleave', () => {
        notification.style.transform = 'translateY(0)';
    });
    
    // Remove notification on click
    notification.addEventListener('click', () => {
        notification.remove();
    });
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Check if the current page has any mountain-related content
function checkForMountainContent() {
    const pageText = document.body.innerText.toLowerCase();
    const mountainKeywords = ['mountain', 'peak', 'summit', 'climb', 'hike', 'trail', 'elevation'];
    
    const hasMountainContent = mountainKeywords.some(keyword => 
        pageText.includes(keyword)
    );
    
    if (hasMountainContent) {
        // Could enhance this to extract mountain names or coordinates from the page
        console.log('Mountain-related content detected on this page');
    }
}

// Run content check when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForMountainContent);
} else {
    checkForMountainContent();
}

// Listen for dynamic content changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            // Check for new mountain content when DOM changes
            setTimeout(checkForMountainContent, 1000);
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});
