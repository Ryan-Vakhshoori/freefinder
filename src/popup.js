import feather from 'feather-icons';
import { parseAvailability } from './utils/availabilityUtils.js';
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
    chrome.storage.sync.get(["startOfDay", "endOfDay", "minSlotDuration", "bufferBeforeEvents"], (data) => {
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

  chrome.storage.sync.set({ startOfDay, endOfDay, minSlotDuration, bufferBeforeEvents }, () => {
    fetchAvailability();
  });
}

document.getElementById("startOfDay").addEventListener("input", saveSettings);
document.getElementById("endOfDay").addEventListener("input", saveSettings);
document.getElementById("minSlotDuration").addEventListener("input", saveSettings);
document.getElementById("bufferBeforeEvents").addEventListener("input", saveSettings);

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
      const days = Array.isArray(response.data[0]) ? response.data[0] : parseAvailability(response.data[0]);
      renderAvailability(days);
    } else {
      console.log("No response from content script.");
    }
  });
}
