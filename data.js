document.addEventListener('DOMContentLoaded', function() {
    const dataInput = document.getElementById('dataInput');
    const saveButton = document.getElementById('saveButton');
    // const statusMessage = document.getElementById('statusMessage'); // No longer needed

    saveButton.addEventListener('click', function() {
        const textData = dataInput.value;
        
        if (!textData.trim()) {
            // Use Toastify for the error message
            Toastify({
                text: "Textarea is empty. Please paste your data.",
                duration: 3000,
                gravity: "top", // `top` or `bottom`
                position: "center", // `left`, `center` or `right`
                backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
                style: {
                    fontSize: "18px",
                    padding: "16px 24px",
                    borderRadius: "8px"
                }
            }).showToast();
            return;
        }

        const lines = textData.split('\n');
        const contactList = [];
        let currentContact = null;

        for (const line of lines) {
            let number = '';
            let message = '';
            let isNewRecord = false;
            const trimmedLine = line.trim();

            if (!trimmedLine) {
                if (currentContact) {
                    currentContact.message += '\n';
                }
                continue;
            }

            if (trimmedLine.includes('\t')) {
                const parts = trimmedLine.split('\t');
                const potentialNumber = parts[0].trim();
                if (/^\+?\d+$/.test(potentialNumber)) {
                    isNewRecord = true;
                    number = potentialNumber;
                    message = parts.slice(1).join('\t').trim();
                }
            } else {
                const firstSpaceIndex = trimmedLine.indexOf(' ');
                if (firstSpaceIndex !== -1) {
                    const potentialNumber = trimmedLine.substring(0, firstSpaceIndex).trim();
                    if (/^\+?\d+$/.test(potentialNumber)) {
                        isNewRecord = true;
                        number = potentialNumber;
                        message = trimmedLine.substring(firstSpaceIndex + 1).trim();
                    }
                }
            }

            if (isNewRecord) {
                if (currentContact) {
                    contactList.push(currentContact);
                }
                currentContact = {
                    number: number,
                    message: message,
                    sent: false
                };
            } else if (currentContact) {
                currentContact.message += '\n' + line;
            }
        }

        if (currentContact) {
            contactList.push(currentContact);
        }

        if (contactList.length === 0) {
            // Use Toastify for the warning message
            Toastify({
                text: "No valid data found. Each new entry must start with a number.",
                duration: 4000,
                gravity: "top",
                position: "center",
                backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
                style: {
                    fontSize: "18px",
                    padding: "16px 24px",
                    borderRadius: "8px"
                }
            }).showToast();
            return;
        }

        chrome.storage.local.set({ 'contactList': contactList }, function() {
            if (chrome.runtime.lastError) {
                // Use Toastify for the runtime error
                Toastify({
                    text: 'Error saving data: ' + chrome.runtime.lastError.message,
                    duration: 5000,
                    gravity: "top",
                    position: "center",
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
                    style: {
                        fontSize: "18px",
                        padding: "16px 24px",
                        borderRadius: "8px"
                    }
                }).showToast();
            } else {
                // --- THIS IS THE MAIN CHANGE YOU ASKED FOR ---
                // Show a nice success toast notification!
                Toastify({
                    text: `Successfully saved ${contactList.length} contacts!`,
                    duration: 3000,
                    close: true,
                    gravity: "top", 
                    position: "center", 
                    backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
                    stopOnFocus: true, // Prevents dismissing of toast on hover
                    style: {
                        fontSize: "36px",
                        padding: "16px 24px",
                        borderRadius: "8px"
                    }
                }).showToast();
                
                dataInput.value = ''; // Clear the textarea on success
            }
        });
    });
});