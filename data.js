document.addEventListener('DOMContentLoaded', function() {
    const dataInput = document.getElementById('dataInput');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');
  
    saveButton.addEventListener('click', function() {
      const textData = dataInput.value; // Get the raw value, don't trim the whole thing yet
      statusMessage.textContent = '';
  
      if (!textData.trim()) {
        statusMessage.textContent = 'Textarea is empty. Please paste your data.';
        statusMessage.style.color = 'red';
        return;
      }
  
      const lines = textData.split('\n');
      const contactList = [];
      let currentContact = null; // This will hold the record we are currently building
  
      for (const line of lines) {
        let number = '';
        let message = '';
        let isNewRecord = false;
  
        // --- Attempt to parse this line as the start of a NEW record ---
        const trimmedLine = line.trim();
        
        // A line could be a continuation of a message but be empty (e.g., an extra line break)
        // We don't want to skip it if we are in the middle of a message.
        // But we will use trimmedLine for parsing logic.
        if (!trimmedLine) {
          // If it's just an empty line and we have a contact, add the newline to the message.
          if(currentContact) {
              currentContact.message += '\n';
          }
          continue;
        }
        
        // Strategy 1: Check for Tab
        if (trimmedLine.includes('\t')) {
          const parts = trimmedLine.split('\t');
          const potentialNumber = parts[0].trim();
          if (/^\+?\d+$/.test(potentialNumber)) {
            isNewRecord = true;
            number = potentialNumber;
            message = parts.slice(1).join('\t').trim();
          }
        } 
        // Strategy 2: Check for Space
        else {
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
  
        // --- Main Logic: Decide what to do with the line ---
        if (isNewRecord) {
          // This line is a new record.
          // First, save the PREVIOUS complete record to our list.
          if (currentContact) {
            contactList.push(currentContact);
          }
          
          // Now, start the NEW record with the data from this line.
          currentContact = {
            number: number,
            message: message, // This is just the first line of the message
            sent: false
          };
        } else if (currentContact) {
          // This line is NOT a new record, so it must be a continuation of the previous message.
          // Append the original line (with its original spacing/indentation) to the message.
          currentContact.message += '\n' + line;
        }
      }
  
      // --- IMPORTANT: After the loop finishes, the very last contact is still in currentContact. Add it to the list. ---
      if (currentContact) {
        contactList.push(currentContact);
      }
      
      // --- The rest of the saving logic remains the same ---
      if (contactList.length === 0) {
        statusMessage.textContent = 'No valid data was saved. Please check your format. Each new entry must start with a valid number.';
        statusMessage.style.color = 'red';
        return;
      }
  
      chrome.storage.local.set({ 'contactList': contactList }, function() {
        if (chrome.runtime.lastError) {
          statusMessage.textContent = 'Error saving data: ' + chrome.runtime.lastError.message;
          statusMessage.style.color = 'red';
        } else {
          statusMessage.textContent = `Successfully saved ${contactList.length} valid contacts! Now you can send the messages`;
          statusMessage.style.color = 'green';
          dataInput.value = '';
  
          setTimeout(() => {
            statusMessage.textContent = '';
          }, 4000);
        }
      });
    });
  });