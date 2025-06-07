document.addEventListener('DOMContentLoaded', () => {
    const tableContainer = document.getElementById('contactTableContainer');
    const noContactsMessage = document.getElementById('noContactsMessage');
  
    // Fetch the contact list from chrome's local storage
    chrome.storage.local.get(['contactList'], (result) => {
      const contacts = result.contactList;
  
      // Check if the contact list exists and has items
      if (contacts && contacts.length > 0) {
        // If we have contacts, build and render the table
        renderTable(contacts);
      } else {
        // If not, show the "no contacts" message
        noContactsMessage.style.display = 'block';
      }
    });
  
    function renderTable(contacts) {
      // Start building the table HTML
      let tableHTML = `
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;
  
      // Loop through each contact and create a table row
      contacts.forEach(contact => {
        // Determine the status text and class based on the 'send' property
        // This assumes 'send' is a boolean (true/false)
        const statusClass = contact.sent ? 'status-sent' : 'status-pending';
        const statusText = contact.sent ? 'Sent' : 'Pending';
  
        tableHTML += `
          <tr>
            <td>${contact.number || 'N/A'}</td>
            <td>${contact.message || 'N/A'}</td>
            <td>
              <span class="status ${statusClass}">${statusText}</span>
            </td>
          </tr>
        `;
      });
  
      // Close the table body and table tags
      tableHTML += `
          </tbody>
        </table>
      `;
  
      // Inject the complete table HTML into the container
      tableContainer.innerHTML = tableHTML;
    }
  });