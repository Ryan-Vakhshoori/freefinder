import { timeToMinutes, timeToMinutesMilitary, minutesToTime } from "./utils/timeUtils.js"; // Import time utility functions
import { extractDate, normalizeDateString } from "./utils/dateUtils.js"; // Import date utility functions

function waitForNewGridCell(previousCells, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const gridCells = [...document.querySelectorAll('div[role="gridcell"]')];
      const newCells = gridCells.filter(cell => !previousCells.includes(cell));
      if (newCells.length > 0) {
        return resolve(newCells[0]);
      }
      if (Date.now() - start > timeout) {
        return reject(new Error("Timeout waiting for new gridcell"));
      }
      requestAnimationFrame(check);
    })();
  });
}

function waitForGridCellClose(gridCell, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      // If the gridCell is no longer in the DOM, resolve
      if (!document.body.contains(gridCell)) {
        return resolve();
      }

      // If timeout exceeded, reject
      if (Date.now() - start > timeout) {
        return reject(new Error("Timeout waiting for grid cell to be removed"));
      }

      // Keep checking on the next frame
      requestAnimationFrame(check);
    })();
  });
}

async function closeMoreEventsDialog() {
  const hiddenDiv = document.querySelector('div.yDmH0d');
  const closeButton = hiddenDiv.querySelector('div.pYTkkf-Bz112c-RLmnJb');
  if (closeButton) {
    const gridCell = hiddenDiv.querySelector('div[role="gridcell"]');
    closeButton.click(); // Close the month view if it's open
    await waitForGridCellClose(gridCell); // Wait for the grid cell to be removed
  }
}

async function extractAvailability(activeView, dates, callback) {
  let events = [];
  const allDayEvents = document.querySelectorAll('div.KF4T6b.jKgTF.QGRmIf > span.XuJrye');
  if (activeView == "MONTH") {
    await closeMoreEventsDialog(); // Close the "more events" dialogue if it's open
    const gridCells = document.querySelectorAll('div[role="gridcell"]');
    for (let gridCell of gridCells) {
      let buttonDiv = gridCell.querySelector('div.KF4T6b.KCIIIb');
      if (buttonDiv) {
        const oldCells = [...document.querySelectorAll('div[role="gridcell"]')];
        buttonDiv.click();
        gridCell = await waitForNewGridCell(oldCells); // Wait for the new gridcell to be visible
      }
      const spans = gridCell.querySelectorAll('span.XuJrye'); // Query for spans with class XuJrye within the gridcell
      spans.forEach(span => {
        events.push(span); // Append each span to the events array
      });
    }
  } else {
    events = document.querySelectorAll("div.XuJrye:not([id])"); // Select calendar cells
  }
  let eventTimes = {};

  events.forEach(event => {
    const eventText = event.textContent;

    // Regular expression to match time in the form "XX:XXa/pm to XX:XXa/pm" or "Xa/pm to Xa/pm"
    const timeRegex = /\b\d{1,2}(?::\d{2})?(?:am|pm)\s+to\s+\d{1,2}(?::\d{2})?(?:am|pm)\b/i;

    // Check if the event contains a valid time format
    if (!timeRegex.test(eventText)) {
      return; // Skip this event if it doesn't match the time format
    }

    let eventTime = eventText.split(",")[0]; // Get the start time and end time of the event
    let eventStartTime = eventTime.split(" ")[0]; // Extract the start time
    let eventEndTime = eventTime.split(" ")[2]; // Extract the end time
    let eventDate = extractDate(eventText); // Extract the date from the event text
    // Add the event start and end times to the eventTimes dictionary
    if (!eventTimes[eventDate]) {
      eventTimes[eventDate] = []; // Initialize an array for the date if it doesn't exist
    }
    eventTimes[eventDate].push({ start: eventStartTime, end: eventEndTime }); // Add the event times
  });
  // Process all-day events
  allDayEvents.forEach(event => {
    const eventText = event.textContent;
    if (eventText.includes("Holidays")) {
      return; // Skip holidays as they are not considered all-day events
    }
    if (eventText.includes("All day")) {
      let eventDate = extractDate(eventText); // Extract the date from the event text
      if (!eventTimes[eventDate]) {
        eventTimes[eventDate] = []; // Initialize an array for the date if it doesn't exist
      }
      // Add the all-day event with a start time of "00:00" and an end time of "23:59"
      eventTimes[eventDate].push({ start: "12am", end: "11:59pm" });
    }
  });
  let availableSlots = {};
  chrome.storage.sync.get([
    "startOfDay",
    "endOfDay",
    "minSlotDuration",
    "bufferBeforeEvents",
    "bufferAfterEvents"
  ], (data) => {
    const startOfDay = timeToMinutesMilitary(data.startOfDay);
    const endOfDay = timeToMinutesMilitary(data.endOfDay);
    const minSlotDuration = data.minSlotDuration;
    const bufferBefore = parseInt(data.bufferBeforeEvents, 10) || 0;
    const bufferAfter = parseInt(data.bufferAfterEvents, 10) || 0;
    dates.forEach(date => {
      availableSlots[date] = [];
    });

    for (let date in availableSlots) {
      let normalizedDate = date.split(",")[1].trim();
      const eventsForDate = eventTimes[normalizedDate] || [];
      const hasAllDayEvent = eventsForDate.some(
        event => event.start === "12am" && event.end === "11:59pm"
      );
      if (hasAllDayEvent) continue;

      let prevEnd = startOfDay;
      let isFirstSlot = true;

      if (!eventsForDate.length) {
        // No buffer for all-day slot
        const slotDuration = endOfDay - prevEnd;
        if (slotDuration >= minSlotDuration) {
          availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(endOfDay) });
        }
        continue;
      }

      for (let event of eventsForDate) {
        let eventStart = timeToMinutes(event.start);

        // Only apply bufferAfter to slots after the first slot
        let slotStartWithBuffer = prevEnd;
        if (!isFirstSlot) {
          slotStartWithBuffer += bufferAfter;
        }
        let slotEndWithBuffer = Math.max(slotStartWithBuffer, Math.min(eventStart, endOfDay) - bufferBefore);
        const slotDuration = slotEndWithBuffer - slotStartWithBuffer;
        if (slotStartWithBuffer < slotEndWithBuffer && slotDuration >= minSlotDuration) {
          availableSlots[date].push({ start: minutesToTime(slotStartWithBuffer), end: minutesToTime(slotEndWithBuffer) });
        }

        prevEnd = Math.max(prevEnd, timeToMinutes(event.end));
        isFirstSlot = false;
      }

      // For the last slot of the day, do NOT apply bufferBeforeEvents, but DO apply bufferAfterEvents (unless it's the first slot)
      let slotStartWithBuffer = prevEnd;
      if (!isFirstSlot) {
        slotStartWithBuffer += bufferAfter;
      }
      const slotDuration = endOfDay - slotStartWithBuffer;
      if (slotStartWithBuffer < endOfDay && slotDuration >= minSlotDuration) {
        availableSlots[date].push({ start: minutesToTime(slotStartWithBuffer), end: minutesToTime(endOfDay) });
      }
    }
    console.log("Available slots:", availableSlots); // Log the available slots for debugging

    const filteredSlots = Object.entries(availableSlots)
      .filter(([date, slots]) => slots.length > 0)
      .map(([date, slots]) => ({
        date,
        slots: slots.map(slot => `${slot.start} - ${slot.end}`)
      }));

    callback(filteredSlots); // Pass the array of { date, slots } objects to the callback
  });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAvailability") {
    const [ activeView, dates ] = extractTimeframe(); // Call the function to extract dates
    if (dates.length === 0) {
      sendResponse({ data: "Unsupported view" });
      return;
    }
    // Format the date range
    let formattedDateRange;
    if (dates.length > 1) {
      formattedDateRange = `${dates[0]} - ${dates[dates.length - 1]}`;
    } else {
      formattedDateRange = dates[0];
    }
    extractAvailability(activeView, dates, (availability) => { // Call the function to extract availability
      sendResponse({ data: [availability, formattedDateRange] });
    });
    return true; // Keep the message channel open for sendResponse
  } else if (request.action === "ping") {
    sendResponse({ data: "pong" }); // Respond to the ping message
  }
});

function extractTimeframe() {
  const activeViewDiv = document.querySelector('body[data-viewkey]');
  const activeView = activeViewDiv.getAttribute('data-viewkey'); // Log the active view element
  if (activeView == "DAY") {
    let date = document.querySelector('title').textContent; // Extract the date from the title
    date = normalizeDateString(date); // Normalize the date string
    return [ activeView, [date] ]; // Return the date without the year
  } else if (activeView == "WEEK" || activeView == "CUSTOM_DAYS") {
    const dayElements = document.querySelectorAll('h2.hI2jVc'); // Select all day elements
    const dates = Array.from(dayElements).map(day => {
      return normalizeDateString(day.getAttribute('aria-label')); // Normalize the date string
    });
    return [ activeView, dates ]; // Return the array of dates
  } else if (activeView == "MONTH") {
    const dayElements = document.querySelectorAll('h2.CqwSk.XuJrye'); // Select all day elements
    const dates = Array.from(dayElements).map(day => {
      return normalizeDateString(day.textContent); // Normalize the date string
    });
    return [ activeView, dates ]; // Return the array of cleaned dates
  } else {
    return [ activeView, [] ]; // Return an empty array if the view is not DAY, WEEK, or MONTH
  }
}
