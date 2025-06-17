// activate.js

// --- DOM Elements ---
const licenseKeyInput = document.getElementById('licenseKeyInput');
const activateButton = document.getElementById('activateButton');
const statusMessage = document.getElementById('statusMessage');

// --- Helper Functions ---

/**
 * Creates a SHA-256 hash of a string. This is our signature function.
 * @param {string} message - The string to hash.
 * @returns {Promise<string>} The hexadecimal hash string.
 */
async function createSignature(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Displays a feedback message to the user.
 * @param {string} text - The message to show.
 * @param {'success' | 'error' | 'loading'} type - The type of message for styling.
 */
function displayMessage(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = 'status-message'; // Reset classes
  statusMessage.classList.add(`status-${type}`);
}


// --- Main Activation Logic ---

async function handleActivation() {
  const licenseKey = licenseKeyInput.value.trim();

  if (!licenseKey) {
    displayMessage('Please enter a license key.', 'error');
    return;
  }

  // Get the unique device ID from storage
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (!deviceId) {
    displayMessage('Critical error: Could not find device ID. Please reinstall the extension.', 'error');
    return;
  }

  // Disable UI while processing
  activateButton.disabled = true;
  displayMessage('Connecting to activation server...', 'loading');

  try {
    const url = 'https://ausentismos.online/paypal/activatechrome';
    const payload = {
      user: licenseKey,
      unique_id: deviceId,
      token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ" // Your provided token
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server error: Status ${response.status}`);
    }

    const result = await response.json();

    // --- Process Server Response ---
    if (result.activate === true && result.dateexpiration) {
      // SUCCESS: Save the license securely with a signature
      const dataToSign = `${deviceId}:${result.dateexpiration}`;
      const signature = await createSignature(dataToSign);

      const licenseData = {
        expires: result.dateexpiration,
        signature: signature
      };
      
      await chrome.storage.local.set({ license: licenseData });
      
      // Format date for display
      const expiryDate = new Date(result.dateexpiration).toLocaleDateString();
      displayMessage(`Success! Your license is active until ${expiryDate}.`, 'success');

    } else {
      // FAILURE: The server said the key is invalid
      displayMessage('Activation failed. The license key appears to be invalid or has expired.', 'error');
    }

  } catch (error) {
    // ERROR: Network or other fetch-related error
    console.error('Activation Error:', error);
    displayMessage('An error occurred. Please check your internet connection and try again.', 'error');
  } finally {
    // Re-enable the button regardless of outcome
    activateButton.disabled = false;
  }
}

// --- Event Listeners ---
activateButton.addEventListener('click', handleActivation);
licenseKeyInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    handleActivation();
  }
});