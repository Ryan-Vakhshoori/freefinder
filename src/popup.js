document.addEventListener("DOMContentLoaded", () => {
    fetchAvailability();

    chrome.storage.sync.get(["startOfDay", "endOfDay", "minSlotDuration"], (data) => {
        if (data.startOfDay) {
            document.getElementById("startOfDay").value = data.startOfDay;
        }
        if (data.endOfDay) {
            document.getElementById("endOfDay").value = data.endOfDay;
        }
        if (data.minSlotDuration) {
            document.getElementById("minSlotDuration").value = data.minSlotDuration;
        }
    });
});

document.getElementById("copyButton").addEventListener("click", () => {
    const copyButton = document.getElementById("copyButton");
    const text = document.getElementById("availabilityText").value;

    // Copy the text to the clipboard
    navigator.clipboard.writeText(text).then(() => {
        // Change button text to "Copied" and disable the button
        copyButton.textContent = "Copied";
        copyButton.disabled = true;
        copyButton.style.backgroundColor = "#ccc"; // Gray out the button

        // Revert the button back to its original state after 2 seconds
        setTimeout(() => {
            copyButton.textContent = "Copy";
            copyButton.disabled = false;
            copyButton.style.backgroundColor = ""; // Reset to default background color
        }, 2000);
    }).catch(err => console.error("Copy failed:", err));
});

// Function to save workday times
function saveSettings() {
    const startOfDay = document.getElementById("startOfDay").value;
    const endOfDay = document.getElementById("endOfDay").value;
    const minSlotDuration = parseInt(document.getElementById("minSlotDuration").value, 10);

    // Save the times to Chrome storage
    chrome.storage.sync.set({ startOfDay, endOfDay, minSlotDuration }, () => {

        // Optionally fetch availability after saving
        fetchAvailability();
    });
}

// Add event listeners to save times automatically when inputs change
document.getElementById("startOfDay").addEventListener("input", saveSettings);
document.getElementById("endOfDay").addEventListener("input", saveSettings);
document.getElementById("minSlotDuration").addEventListener("input", saveSettings);

function fetchAvailability() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error("No active tab found!");
            return;
        }

        const activeTab = tabs[0];
        const url = activeTab.url;

        const availabilityContainer = document.getElementById("availabilityContainer");
        const unsupportedMessage = document.getElementById("unsupportedMessage");

        // Check if the active tab is on calendar.google.com
        if (!url || !url.includes("calendar.google.com")) {
            availabilityContainer.style.display = "none";
            unsupportedMessage.style.display = "block";
            return;
        }

        availabilityContainer.style.display = "block";
        unsupportedMessage.style.display = "none";

        chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, (response) => {
            if (response && response.data === "pong") {
                console.log("Content script is already injected.");
                sendAvailabilityRequest(activeTab.id);
                return;
            } else if (chrome.runtime.lastError) {
                chrome.scripting.executeScript(
                    {
                        target: { tabId: activeTab.id },
                        files: ["dist/content_script.js"]
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error("Failed to inject content script:", chrome.runtime.lastError.message);
                        } else {
                            console.log("Content script injected successfully.");
                            sendAvailabilityRequest(activeTab.id);
                        }
                    }
                );
            }
        }
        );
    });
}

function sendAvailabilityRequest(tabId) {
    chrome.tabs.sendMessage(tabId, { action: "getAvailability" }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            return;
        }

        document.getElementById("availabilityText").value = ""; // Clear previous availability text
        if (response.data == "Unsupported view") {
            availabilityContainer.style.display = "none";
            unsupportedMessage.style.display = "block";
            unsupportedMessage.textContent = "Unsupported view detected. Please switch to day, week, month, or 4 days view.";
        } else if (response.data) {
            document.getElementById("availabilityText").value = response.data[0];
            document.getElementById("dateRange").textContent = response.data[1];
        } else {
            console.log("No response from content script.");
        }
    });
}

