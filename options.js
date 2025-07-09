document.addEventListener('DOMContentLoaded', function() {
    // Get references to all the input elements and the save button
    const saveButton = document.getElementById('saveButton');
    const inputs = {
        buttonClick: document.getElementById('buttonClick'),
        input: document.getElementById('input'),
        conversation: document.getElementById('conversation'),
        sendMessage: document.getElementById('sendMessage'),
        postSend: document.getElementById('postSend')
    };

    // Function to save options to chrome.storage
    function saveOptions() {
        const newTimes = {};

        // --- VALIDATION AND CONVERSION ---
        for (const key in inputs) {
            const valueInSeconds = parseFloat(inputs[key].value);

            // Validate that the input is a number and is at least 1
            if (isNaN(valueInSeconds) || valueInSeconds < 1) {
                Toastify({
                    text: `Invalid value for "${inputs[key].previousElementSibling.textContent}". Must be at least 1 second.`,
                    duration: 4000,
                    gravity: "top",
                    position: "center",
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
                }).showToast();
                return; // Stop the save process
            }
            // Convert seconds to milliseconds for storage
            newTimes[key] = valueInSeconds * 1000;
        }

        // Structure the data as it is stored
        const newConfig = {
            times: newTimes
        };

        // Save the new configuration object
        chrome.storage.local.set({ 'appConfig': newConfig }, function() {
            // Show a success notification toast
            Toastify({
                text: "Settings saved successfully!",
                duration: 3000,
                gravity: "top",
                position: "center",
                backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
            }).showToast();
        });
    }

    // Function to restore the saved options from chrome.storage
    function restoreOptions() {
        // Use a default object in case nothing is stored yet
        const defaultTimes = {
            buttonClick: 2000,
            input: 3000,
            conversation: 5000,
            sendMessage: 2000,
            postSend: 3000
        };

        chrome.storage.local.get({ appConfig: { times: defaultTimes } }, function(data) {
            const times = data.appConfig.times;
            for (const key in inputs) {
                if (times[key]) {
                    // Convert stored milliseconds to seconds for display in the UI
                    inputs[key].value = times[key] / 1000;
                }
            }
        });
    }

    // Add event listeners
    saveButton.addEventListener('click', saveOptions);
    // Restore the options when the page is loaded
    restoreOptions();
});
