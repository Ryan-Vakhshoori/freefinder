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
    let text = document.getElementById("availabilityText").value;
    navigator.clipboard.writeText(text).catch(err => console.error("Copy failed:", err));
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

        chrome.tabs.sendMessage(tabs[0].id, { action: "getAvailability" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                return;
            }

            document.getElementById("availabilityText").value = ""; // Clear previous availability text

            if (response.data == "Unsupported view") {
                availabilityContainer.style.display = "none";
                unsupportedMessage.style.display = "block";
                unsupportedMessage.textContent = "Unsupported view detected. Please switch to day, week, or month view.";
                return;
            } else if (response.data) {
                console.log(response.data);
                document.getElementById("availabilityText").value = response.data;
            } else {
                console.log("No response from content script.");
            }
        });
    });
}

