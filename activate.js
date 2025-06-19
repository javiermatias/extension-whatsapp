// activate.js

// --- DOM Elements ---
const licenseKeyInput = document.getElementById('licenseKeyInput');
const activateButton = document.getElementById('activateButton');
const statusMessage = document.getElementById('statusMessage');
const licenseStatusDisplay = document.getElementById('licenseStatusDisplay');
const licenseStatusTitle = document.getElementById('licenseStatusTitle');
const currentLicenseInfo = document.getElementById('currentLicenseInfo');

// --- Helper Functions ---

async function createSignature(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


function displayMessage(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = 'status-message';
  statusMessage.classList.add(`status-${type}`);
}


// --- NEW: Function to check and display the current license status ---

async function checkAndDisplayCurrentLicense() {
  const { deviceId, license, user } = await chrome.storage.local.get(['deviceId', 'license', 'user']);

  if (!license) {
    licenseStatusDisplay.className = 'license-status status-inactive';
    licenseStatusTitle.textContent = 'No Active License';
    currentLicenseInfo.textContent = 'You are currently on the free plan with a daily message limit.';
    return;
  }

  // Verify the stored license data
  const expectedSignature = await createSignature(`${deviceId}:${license.expires}:${license.user}`);
  if (expectedSignature !== license.signature) {
    licenseStatusDisplay.className = 'license-status status-error';
    licenseStatusTitle.textContent = 'License Error';
    currentLicenseInfo.textContent = 'Your license data appears to be corrupted. Please reactivate or contact support.';
    return;
  }

  // Calculate remaining days
  const expiryDate = new Date(license.expires);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date to the beginning of the day

  if (expiryDate < today) {
    licenseStatusDisplay.className = 'license-status status-inactive';
    licenseStatusTitle.textContent = 'License Expired';
    currentLicenseInfo.textContent = `Your license expired on ${expiryDate.toLocaleDateString()}.`;
    return;
  }
  
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  licenseStatusDisplay.className = 'license-status status-active';
  licenseStatusTitle.textContent = `License user: ${license.user}`;
  currentLicenseInfo.innerHTML = `Your premium features are unlocked. Your license will expire in <strong>${diffDays} day(s)</strong> on ${expiryDate.toLocaleDateString()}.`;
}


// --- Main Activation Logic ---

async function handleActivation() {
  const licenseKey = licenseKeyInput.value.trim();
  if (!licenseKey) {
    displayMessage('Please enter a license key.', 'error');
    return;
  }

  let { deviceId } = await chrome.storage.local.get('deviceId');
  if (!deviceId) {
    //displayMessage('Critical error: Could not find device ID. Please reinstall the extension.', 'error');
    //return;
    deviceId = "notfound"
  }

  activateButton.disabled = true;
  displayMessage('Connecting to activation server...', 'loading');

  try {
    const url = 'https://ausentismos.online/paypal/activateChromeLicense';
    const payload = {
      user: licenseKey,
      unique_id: deviceId,
      mex:false,
      token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Server error: Status ${response.status}`);
    const result = await response.json();

    if (result.activate === true && result.dateexpiration) {
      const dataToSign = `${deviceId}:${result.dateexpiration}:${licenseKey}`;
      const signature = await createSignature(dataToSign);
      
      await chrome.storage.local.set({ license: { expires: result.dateexpiration, signature: signature, user: licenseKey } });
      
      displayMessage('Activation successful!', 'success');
      // **UPDATE**: Refresh the status display after successful activation
      await checkAndDisplayCurrentLicense();
      licenseKeyInput.value = ''; // Clear the input field

    } else {
      displayMessage('Activation failed. The license key appears to be invalid or has expired.', 'error');
    }

  } catch (error) {
    console.error('Activation Error:', error);
    displayMessage('An error occurred. Please check your internet connection and try again.', 'error');
  } finally {
    activateButton.disabled = false;
  }
}


// --- Event Listeners ---
// Run the check when the page is loaded
document.addEventListener('DOMContentLoaded', checkAndDisplayCurrentLicense);
activateButton.addEventListener('click', handleActivation);
licenseKeyInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    handleActivation();
  }
});