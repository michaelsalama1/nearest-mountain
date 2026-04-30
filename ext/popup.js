// State variables (equivalent to React useState)
let latitude = null;
let longitude = null;
let nearestMountains = null;
let elevation = 500;
let showCoordinateInput = false;
let newLatitude = "";
let newLongitude = "";
let locationError = false;
let showAbout = false;
let currentMountainIndex = 0;

// DOM elements
const locationDisplay = document.getElementById('locationDisplay');
const displayLat = document.getElementById('displayLat');
const displayLon = document.getElementById('displayLon');
const changeCoordinatesBtn = document.getElementById('changeCoordinatesBtn');
const loadingState = document.getElementById('loadingState');
const statusMessage = document.getElementById('statusMessage');
const randomPeakBtn = document.getElementById('randomPeakBtn');
const coordinateForm = document.getElementById('coordinateForm');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const elevationInput = document.getElementById('elevation');
const mountainInfo = document.getElementById('mountainInfo');
const mountainName = document.getElementById('mountainName');
const mountainRegion = document.getElementById('mountainRegion');
const mountainLat = document.getElementById('mountainLat');
const mountainLon = document.getElementById('mountainLon');
const mountainDistance = document.getElementById('mountainDistance');
const mountainElevation = document.getElementById('mountainElevation');
const sliderControls = document.getElementById('sliderControls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const sliderIndex = document.getElementById('sliderIndex');
const googleMapsLink = document.getElementById('googleMapsLink');
const randomRangeBtn = document.getElementById('randomRangeBtn');
const loadingMessage = document.getElementById('loadingMessage');
const aboutBtn = document.getElementById('aboutBtn');
const aboutOverlay = document.getElementById('aboutOverlay');
const closeAboutBtn = document.getElementById('closeAboutBtn');

// Event listeners
changeCoordinatesBtn.addEventListener('click', () => setShowCoordinateInput(true));
randomPeakBtn.addEventListener('click', generateRandomRange);
coordinateForm.addEventListener('submit', handleCoordinateSubmit);
elevationInput.addEventListener('change', handleElevationChange);
prevBtn.addEventListener('click', handlePrevious);
nextBtn.addEventListener('click', handleNext);
randomRangeBtn.addEventListener('click', generateRandomRange);
aboutBtn.addEventListener('click', () => setShowAbout(true));
closeAboutBtn.addEventListener('click', () => setShowAbout(false));

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
    // Extract coordinates from URL and process
    extractCoordinatesFromURL();
});

// Extract coordinates from current URL
function extractCoordinatesFromURL() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            const currentURL = tabs[0].url;
            console.log('Current URL:', currentURL);
            
            // Look for coordinates in the format @lat,lng,
            const coordinateRegex = /@(-?\d+\.\d+),(-?\d+\.\d+),/;
            const match = currentURL.match(coordinateRegex);
            
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                
                setLatitude(lat);
                setLongitude(lng);
                locationError = false;
                showCoordinateInput = false;
                
                console.log('Coordinates extracted from URL:', lat, lng);
                statusMessage.textContent = `Coordinates found: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            } else {
                // No coordinates found in URL
                locationError = true;
                showCoordinateInput = true;
                statusMessage.textContent = 'No coordinates found in URL. Expected format: @lat,lng,';
                console.log('No coordinates found in URL');
            }
        } else {
            locationError = true;
            showCoordinateInput = true;
            statusMessage.textContent = 'Unable to access current tab URL';
            console.log('Unable to access tab URL');
        }
        
        // Update UI after attempting to extract coordinates
        updateUI();
    });
}

// Set latitude and longitude
function setLatitude(lat) {
    latitude = lat;
    displayLat.textContent = lat.toFixed(4);
}

function setLongitude(lon) {
    longitude = lon;
    displayLon.textContent = lon.toFixed(4);
}

// Set showCoordinateInput state
function setShowCoordinateInput(show) {
    showCoordinateInput = show;
    coordinateForm.style.display = show ? 'block' : 'none';
}

// Set showAbout state
function setShowAbout(show) {
    showAbout = show;
    aboutOverlay.style.display = show ? 'flex' : 'none';
}

// Update UI based on current state
function updateUI() {
    if (latitude && longitude) {
        locationDisplay.style.display = 'block';
        loadingState.style.display = 'none';
        
        // Fetch mountain data
        fetchMountainData();
    } else {
        locationDisplay.style.display = 'none';
        loadingState.style.display = 'block';
        mountainInfo.style.display = 'none';
        loadingMessage.style.display = 'none';
    }
    
    if (showCoordinateInput) {
        coordinateForm.style.display = 'block';
    }
}

// Handle coordinate form submission
function handleCoordinateSubmit(event) {
    event.preventDefault();
    const lat = parseFloat(event.target.latitude.value);
    const lon = parseFloat(event.target.longitude.value);
    
    setLatitude(lat);
    setLongitude(lon);
    setShowCoordinateInput(false);
    locationError = false;
    
    // Clear form
    event.target.latitude.value = '';
    event.target.longitude.value = '';
    
    // Update UI and fetch mountain data
    updateUI();
}

// Handle elevation change
function handleElevationChange(event) {
    elevation = parseInt(event.target.value);
    if (latitude && longitude) {
        fetchMountainData();
    }
}

// Fetch mountain data from API
async function fetchMountainData() {
    if (!latitude || !longitude) return;
    
    try {
        loadingMessage.style.display = 'block';
        mountainInfo.style.display = 'none';
        
        const response = await fetch(`https://www.nearestmountain.com/api/nearestMountain?lat=${latitude}&lon=${longitude}&minElevation=${elevation}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            nearestMountains = data;
            currentMountainIndex = 0;
            displayMountainData();
        } else {
            throw new Error('No mountains found');
        }
        
    } catch (error) {
        console.error('Error fetching mountain data:', error);
        statusMessage.textContent = 'Error fetching mountain data. Please try again.';
        loadingMessage.style.display = 'none';
    }
}

// Display mountain data
function displayMountainData() {
    if (!nearestMountains || nearestMountains.length === 0) return;
    
    const mountain = nearestMountains[currentMountainIndex];
    
    mountainName.textContent = mountain.name || 'Unnamed Peak';
    mountainRegion.textContent = mountain.region || 'Unknown Region';
    mountainLat.textContent = mountain.lat.toFixed(4);
    mountainLon.textContent = mountain.lon.toFixed(4);
    mountainDistance.textContent = haversine(latitude, longitude, mountain.lat, mountain.lon).toFixed(2);
    mountainElevation.textContent = mountain.elevation_high || mountain.elevation_low || 'Unknown';
    
    // Update Google Maps link and add click handler to open in same tab
    googleMapsLink.href = `https://www.google.com/maps?q=${mountain.lat},${mountain.lon}`;
    googleMapsLink.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.update({ url: googleMapsLink.href });
    };
    
    // Show/hide slider controls
    if (nearestMountains.length > 1) {
        sliderControls.style.display = 'flex';
        updateSliderIndex();
    } else {
        sliderControls.style.display = 'none';
    }
    
    mountainInfo.style.display = 'block';
    loadingMessage.style.display = 'none';
}

// Update slider index display
function updateSliderIndex() {
    sliderIndex.textContent = `${currentMountainIndex + 1} / ${nearestMountains.length}`;
}

// Handle previous button
function handlePrevious() {
    if (!nearestMountains) return;
    
    currentMountainIndex = currentMountainIndex > 0 ? currentMountainIndex - 1 : nearestMountains.length - 1;
    displayMountainData();
}

// Handle next button
function handleNext() {
    if (!nearestMountains) return;
    
    currentMountainIndex = (currentMountainIndex + 1) % nearestMountains.length;
    displayMountainData();
}

// Generate random mountain range
async function generateRandomRange() {
    if (!latitude || !longitude) return;
    
    try {
        loadingMessage.style.display = 'block';
        mountainInfo.style.display = 'none';
        
        const response = await fetch(`https://www.nearestmountain.com/api/randomRange?lat=${latitude}&lon=${longitude}&minElevation=${elevation}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            nearestMountains = data;
            currentMountainIndex = 0;
            displayMountainData();
        } else {
            throw new Error('No random mountain found');
        }
        
    } catch (error) {
        console.error('Error fetching random mountain:', error);
        statusMessage.textContent = 'Error fetching random mountain. Please try again.';
        loadingMessage.style.display = 'none';
    }
}

// Haversine distance calculation
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
