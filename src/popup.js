import feather from 'feather-icons';
import { slotsToPoints } from './utils/availabilityUtils.js';
import { initializeSettings } from './utils/settings.js';
import { renderAvailability } from './utils/availabilityUI.js';

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      console.error("No active tab found!");
      return;
    }
    const activeTab = tabs[0];
    const url = activeTab.url;

    const availabilityContainer = document.getElementById("availabilityContainer");
    const unsupportedMessage = document.getElementById("unsupportedMessage");

    if (!url || !url.includes("calendar.google.com")) {
      availabilityContainer.classList.add("hidden");
      unsupportedMessage.classList.add("open");
      return;
    }
    initializeSettings();
    chrome.storage.sync.get([
      "startOfDay",
      "endOfDay",
      "minSlotDuration",
      "bufferBeforeEvents",
      "bufferAfterEvents",
      "availabilityFormat",
      "pointInterval"
    ], (data) => {
      if (data.startOfDay) {
        document.getElementById("startOfDay").value = data.startOfDay;
      }
      if (data.endOfDay) {
        document.getElementById("endOfDay").value = data.endOfDay;
      }
      if (data.minSlotDuration) {
        document.getElementById("minSlotDuration").value = data.minSlotDuration;
      }
      if (data.bufferBeforeEvents) {
        document.getElementById("bufferBeforeEvents").value = data.bufferBeforeEvents;
      }
      if (data.bufferAfterEvents) {
        document.getElementById("bufferAfterEvents").value = data.bufferAfterEvents;
      }
      // Set the radio button based on saved availabilityFormat
      if (data.availabilityFormat === "points") {
        document.getElementById("formatPoints").checked = true;
        document.getElementById("pointIntervalSetting").classList.add("open");
      } else {
        document.getElementById("formatRanges").checked = true;
        document.getElementById("pointIntervalSetting").classList.remove("open");
      }
      if (data.pointInterval) {
        document.getElementById("pointInterval").value = data.pointInterval;
      }
    });
    fetchAvailability();

    // Replace the settings button SVG with a Feather icon dynamically
    const settingsBtn = document.getElementById("settingsBtn");
    if (settingsBtn) {
      settingsBtn.innerHTML = feather.icons.settings.toSvg({ width: 25, height: 25, stroke: "#eff2f6" });
    }

    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.innerHTML = feather.icons['arrow-left'].toSvg({ width: 22, height: 22, stroke: "#eff2f6" });
      backBtn.addEventListener("click", () => {
        document.getElementById("settingsContainer").classList.remove("open");
        document.getElementById("availabilityContainer").classList.remove("hidden");
      });
    }
  });
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  console.log("Settings button clicked");
  document.getElementById("availabilityContainer").classList.add("hidden");
  const panel = document.getElementById("settingsContainer");
  panel.classList.toggle("open");
});

function saveSettings() {
  const startOfDay = document.getElementById("startOfDay").value;
  const endOfDay = document.getElementById("endOfDay").value;
  const minSlotDuration = parseInt(document.getElementById("minSlotDuration").value, 10);
  const bufferBeforeEvents = parseInt(document.getElementById("bufferBeforeEvents").value, 10) || 0;
  const bufferAfterEvents = parseInt(document.getElementById("bufferAfterEvents").value, 10) || 0;
  const availabilityFormat = document.querySelector('input[name="availabilityFormat"]:checked')?.id === "formatPoints" ? "points" : "ranges";
  const pointInterval = parseInt(document.getElementById("pointInterval").value, 10) || 30;

  chrome.storage.sync.set(
    { startOfDay, endOfDay, minSlotDuration, bufferBeforeEvents, bufferAfterEvents, availabilityFormat, pointInterval },
    () => {
      fetchAvailability();
    }
  );
}

document.getElementById("startOfDay").addEventListener("input", saveSettings);
document.getElementById("endOfDay").addEventListener("input", saveSettings);
document.getElementById("minSlotDuration").addEventListener("input", saveSettings);
document.getElementById("bufferBeforeEvents").addEventListener("input", saveSettings);
document.getElementById("bufferAfterEvents").addEventListener("input", saveSettings);
document.getElementById("formatRanges").addEventListener("change", saveSettings);
document.getElementById("formatPoints").addEventListener("change", saveSettings);
document.getElementById("pointInterval").addEventListener("input", saveSettings);

// Show/hide pointIntervalSetting based on selected format
function updatePointIntervalVisibility() {
  const pointIntervalSetting = document.getElementById("pointIntervalSetting");
  const formatPoints = document.getElementById("formatPoints");
  if (formatPoints.checked) {
    pointIntervalSetting.classList.add("open");
  } else {
    pointIntervalSetting.classList.remove("open");
  }
}

// Initial call on load
updatePointIntervalVisibility();

// Listen for changes to radio buttons
document.getElementById("formatRanges").addEventListener("change", updatePointIntervalVisibility);
document.getElementById("formatPoints").addEventListener("change", updatePointIntervalVisibility);

export function fetchAvailability() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, (response) => {
      if (response && response.data === "pong") {
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
              sendAvailabilityRequest(activeTab.id);
            }
          }
        );
      }
    });
  });
}

function sendAvailabilityRequest(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "getAvailability" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
      return;
    }

    const availabilityContainer = document.getElementById("availabilityContainer");
    const unsupportedMessage = document.getElementById("unsupportedMessage");

    if (response.data == "Unsupported view") {
      availabilityContainer.classList.add("hidden");
      unsupportedMessage.classList.add("open");
      unsupportedMessage.textContent = "Unsupported view detected. Please switch to day, week, month, or 4 days view.";
    } else if (response.data) {
      document.getElementById("dateRange").textContent = response.data[1];
      chrome.storage.sync.get(["availabilityFormat", "pointInterval", "minSlotDuration"], (settings) => {
        let days;
        if ("availabilityFormat" in settings && settings.availabilityFormat === "points") {
          days = slotsToPoints(response.data[0], parseInt(settings.pointInterval, 10) || 30, parseInt(settings.minSlotDuration, 10) || 0);
        } else {
          days = response.data[0];
        }
        renderAvailability(days);
      })
      // const days = Array.isArray(response.data[0]) ? response.data[0] : parseAvailability(response.data[0]);
    } else {
      console.log("No response from content script.");
    }
  });
}
