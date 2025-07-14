const licenseKeyInput = document.getElementById('licenseKeyInput');
const activateButton = document.getElementById('activateButton');
// const statusMessage = document.getElementById('statusMessage'); // No longer needed
const licenseStatusDisplay = document.getElementById('licenseStatusDisplay');
const licenseStatusTitle = document.getElementById('licenseStatusTitle');
const currentLicenseInfo = document.getElementById('currentLicenseInfo');


// --- NEW: Replaces the old displayMessage function with Toastify ---
/**
 * Displays a toast notification that stays until the user closes it.
 * @param {string} text The message to display.
 * @param {'success'|'error'|'info'} type The type of toast to show.
 */
function displayToast(text, type) {
    let backgroundColor;

    switch (type) {
        case 'success':
            backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)";
            break;
        case 'error':
            backgroundColor = "linear-gradient(to right, #ff5f6d, #ffc371)";
            break;
        case 'info':
        default:
            backgroundColor = "linear-gradient(to right, #00c6ff, #0072ff)";
            break;
    }

    Toastify({
        text: text,
        duration: 0, // 0 means the toast stays until the user closes it
        close: true, // Shows the 'X' button to close the toast
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        backgroundColor: backgroundColor,
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
          fontSize: "26px",
          padding: "16px 24px",
          borderRadius: "8px"
      }
    }).showToast();
}


// --- Helper Functions (Unchanged) ---
async function createSignature(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// --- License Status Check (Unchanged) ---
async function checkAndDisplayCurrentLicense() {
    // This function remains the same as it correctly updates the static display area.
    const { deviceId, license } = await chrome.storage.local.get(['deviceId', 'license']);

    if (!license) {
        licenseStatusDisplay.className = 'license-status status-inactive';
        licenseStatusTitle.textContent = 'No Active License';
        currentLicenseInfo.textContent = 'You are currently on the free plan with a daily message limit.';
        return;
    }
    const expectedSignature = await createSignature(`${deviceId}:${license.expires}:${license.user}`);
    if (expectedSignature !== license.signature) {
        licenseStatusDisplay.className = 'license-status status-error';
        licenseStatusTitle.textContent = 'License Error';
        currentLicenseInfo.textContent = 'Your license data appears to be corrupted. Please reactivate or contact support.';
        return;
    }
    const expiryDate = new Date(license.expires);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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


// --- Main Activation Logic (Updated to use displayToast) ---
async function handleActivation() {
    const licenseKey = licenseKeyInput.value.trim();
    if (!licenseKey) {
        displayToast('Please enter a license key.', 'error'); // REPLACED
        return;
    }

    let { deviceId } = await chrome.storage.local.get('deviceId');
    if (!deviceId) {
        displayToast('Critical error: Could not find device ID. Please reinstall.', 'error'); // REPLACED
        return;
    }

    activateButton.disabled = true;
    displayToast('Connecting to activation server...', 'info'); // REPLACED

    try {
        const url = 'https://ausentismos.online/paypal/activateWhatsappLicense';
        const payload = { user: licenseKey, unique_id: deviceId, token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ" };

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

            displayToast('Activation successful!', 'success'); // REPLACED
            await checkAndDisplayCurrentLicense();
            licenseKeyInput.value = '';

        } else {
            // REPLACED
            displayToast(result.message || 'Activation failed. The license key is invalid or has expired.', 'error');
        }

    } catch (error) {
        console.error('Activation Error:', error);
        // REPLACED
        displayToast('An error occurred. Please check your internet connection and try again.', 'error');
    } finally {
        activateButton.disabled = false;
    }
}


// --- Event Listeners (Unchanged) ---
document.addEventListener('DOMContentLoaded', checkAndDisplayCurrentLicense);
activateButton.addEventListener('click', handleActivation);
licenseKeyInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleActivation();
    }
});