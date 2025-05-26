import feather from 'feather-icons';

document.addEventListener("DOMContentLoaded", () => {
  initializeSettings();
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
  fetchAvailability();
});

function initializeSettings() {
  chrome.storage.sync.get(["startOfDay", "endOfDay", "minSlotDuration"], (data) => {
    const defaults = {
      startOfDay: "00:00",
      endOfDay: "23:59",
      minSlotDuration: 1
    };

    const settingsToSet = {};

    if (!data.startOfDay) {
      settingsToSet.startOfDay = defaults.startOfDay;
    }
    if (!data.endOfDay) {
      settingsToSet.endOfDay = defaults.endOfDay;
    }
    if (!data.minSlotDuration) {
      settingsToSet.minSlotDuration = defaults.minSlotDuration;
    }

    if (Object.keys(settingsToSet).length > 0) {
      chrome.storage.sync.set(settingsToSet);
    }
  });
}

function saveSettings() {
  const startOfDay = document.getElementById("startOfDay").value;
  const endOfDay = document.getElementById("endOfDay").value;
  const minSlotDuration = parseInt(document.getElementById("minSlotDuration").value, 10);

  chrome.storage.sync.set({ startOfDay, endOfDay, minSlotDuration }, () => {
    fetchAvailability();
  });
}

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

    if (!url || !url.includes("calendar.google.com")) {
      availabilityContainer.style.display = "none";
      unsupportedMessage.style.display = "block";
      return;
    }

    availabilityContainer.style.display = "block";
    unsupportedMessage.style.display = "none";

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

    const availabilityDays = document.getElementById("availabilityDays");
    availabilityDays.innerHTML = ""; // Clear previous

    const availabilityContainer = document.getElementById("availabilityContainer");
    const unsupportedMessage = document.getElementById("unsupportedMessage");

    if (response.data == "Unsupported view") {
      availabilityContainer.style.display = "none";
      unsupportedMessage.style.display = "block";
      unsupportedMessage.textContent = "Unsupported view detected. Please switch to day, week, month, or 4 days view.";
    } else if (response.data) {
      document.getElementById("dateRange").textContent = response.data[1];
      const days = Array.isArray(response.data[0]) ? response.data[0] : parseAvailability(response.data[0]);
      days.forEach(day => {
        const dayDiv = document.createElement("div");
        dayDiv.className = "day-component";

        // Header
        const header = document.createElement("div");
        header.className = "day-header";
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.justifyContent = "space-between";
        header.style.gap = "8px";

        // Title (left)
        const title = document.createElement("span");
        title.className = "day-title";
        title.textContent = day.date;

        // Right-side controls (copy + expand)
        const rightControls = document.createElement("div");
        rightControls.style.display = "flex";
        rightControls.style.alignItems = "center";
        rightControls.style.gap = "8px";

        // Copy Day button
        const copyDayBtn = document.createElement("button");
        copyDayBtn.className = "copy-day-btn";
        copyDayBtn.title = "Copy all slots for this day";
        copyDayBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
        copyDayBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (copyDayBtn._isCheck) return;

          const text = `${day.date}\n${day.slots.join("\n")}`;
          navigator.clipboard.writeText(text);

          copyDayBtn.innerHTML = feather.icons.check.toSvg({ width: 16, height: 16 });
          copyDayBtn.classList.add("checking");
          copyDayBtn._isCheck = true;
          if (copyDayBtn._timeoutId) clearTimeout(copyDayBtn._timeoutId);
          copyDayBtn._timeoutId = setTimeout(() => {
            copyDayBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
            copyDayBtn.classList.remove("checking");
            copyDayBtn._isCheck = false;
            copyDayBtn._timeoutId = null;
          }, 1200);
        });

        // Expand/Collapse button (icon)
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "toggle-btn";
        toggleBtn.title = "Expand/Collapse";
        toggleBtn.innerHTML = feather.icons['chevron-up'].toSvg({ width: 18, height: 18 }); // Default to expanded

        let expanded = true; // Default to expanded
        const slotsDiv = document.createElement("div");
        slotsDiv.className = "day-slots";
        slotsDiv.style.display = "block"; // Show slots by default

        // Toggle logic for button
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent triggering expand/collapse from header click
          expanded = !expanded;
          slotsDiv.style.display = expanded ? "block" : "none";
          toggleBtn.innerHTML = expanded
            ? feather.icons['chevron-up'].toSvg({ width: 18, height: 18 })
            : feather.icons['chevron-down'].toSvg({ width: 18, height: 18 });
        });

        // Also allow clicking the entire day component to expand/collapse
        dayDiv.addEventListener("click", (e) => {
          // Only toggle if the click is not on a button inside rightControls
          if (
            e.target !== copyDayBtn &&
            e.target !== toggleBtn &&
            !copyDayBtn.contains(e.target) &&
            !toggleBtn.contains(e.target)
          ) {
            expanded = !expanded;
            slotsDiv.style.display = expanded ? "block" : "none";
            toggleBtn.innerHTML = expanded
              ? feather.icons['chevron-up'].toSvg({ width: 18, height: 18 })
              : feather.icons['chevron-down'].toSvg({ width: 18, height: 18 });
          }
        });

        // Add controls to rightControls container
        rightControls.appendChild(copyDayBtn);
        rightControls.appendChild(toggleBtn);

        // Add left and right to header
        header.appendChild(title);
        header.appendChild(rightControls);

        day.slots.forEach(slot => {
          const slotDiv = document.createElement("div");
          slotDiv.className = "slot";
          slotDiv.style.display = "flex";
          slotDiv.style.alignItems = "center";
          slotDiv.style.justifyContent = "space-between";
          slotDiv.style.gap = "8px";

          const slotSpan = document.createElement("span");
          slotSpan.textContent = slot;

          // For each slot copy button
          const copySlotBtn = document.createElement("button");
          copySlotBtn.className = "copy-slot-btn";
          copySlotBtn.title = "Copy this slot";
          copySlotBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
          copySlotBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (copySlotBtn._isCheck) return;

            const text = `${day.date}\n${slot}`;
            navigator.clipboard.writeText(text);

            copySlotBtn.innerHTML = feather.icons.check.toSvg({ width: 16, height: 16 });
            copySlotBtn.classList.add("checking");
            copySlotBtn._isCheck = true;
            if (copySlotBtn._timeoutId) clearTimeout(copySlotBtn._timeoutId);
            copySlotBtn._timeoutId = setTimeout(() => {
              copySlotBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
              copySlotBtn.classList.remove("checking");
              copySlotBtn._isCheck = false;
              copySlotBtn._timeoutId = null;
            }, 1200);
          });

          slotDiv.appendChild(slotSpan);
          slotDiv.appendChild(copySlotBtn);
          slotsDiv.appendChild(slotDiv);
        });

        dayDiv.appendChild(header);
        dayDiv.appendChild(slotsDiv);
        availabilityDays.appendChild(dayDiv);
      });
      // After document.getElementById("dateRange").textContent = response.data[1];
      const copyAllButton = document.getElementById("copyAllButton");
      copyAllButton.innerHTML = feather.icons.copy.toSvg({ width: 18, height: 18 });
      copyAllButton.classList.remove("checking");
      copyAllButton._isCheck = false;

      copyAllButton.onclick = function () {
        if (copyAllButton._isCheck) return;
        // Gather all slots for all days
        const allText = days.map(day => `${day.date}\n${day.slots.join("\n")}`).join("\n\n");
        navigator.clipboard.writeText(allText);

        copyAllButton.innerHTML = feather.icons.check.toSvg({ width: 18, height: 18 });
        copyAllButton.classList.add("checking");
        copyAllButton._isCheck = true;
        if (copyAllButton._timeoutId) clearTimeout(copyAllButton._timeoutId);
        copyAllButton._timeoutId = setTimeout(() => {
          copyAllButton.innerHTML = feather.icons.copy.toSvg({ width: 18, height: 18 });
          copyAllButton.classList.remove("checking");
          copyAllButton._isCheck = false;
          copyAllButton._timeoutId = null;
        }, 1200);
      };
      if (window.feather) {
        console.log("Feather icons found, replacing icons.");
        feather.replace();
      }
    } else {
      console.log("No response from content script.");
    }
  });
}

// Helper: parse plain text availability into days and slots
function parseAvailability(text) {
  const lines = text.split("\n");
  const days = [];
  let currentDay = null;
  lines.forEach(line => {
    if (!line.trim()) return;
    if (isNaN(Number(line[0]))) {
      if (currentDay) days.push(currentDay);
      currentDay = { date: line, slots: [] };
    } else if (currentDay) {
      currentDay.slots.push(line);
    }
  });
  if (currentDay) days.push(currentDay);
  return days;
}

