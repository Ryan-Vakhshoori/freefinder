export function initializeSettings() {
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