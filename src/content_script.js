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
  chrome.storage.sync.get(["startOfDay", "endOfDay", "minSlotDuration"], (data) => {
    const startOfDay = timeToMinutesMilitary(data.startOfDay)
    const endOfDay = timeToMinutesMilitary(data.endOfDay)
    const minSlotDuration = data.minSlotDuration
    dates.forEach(date => {
      availableSlots[date] = []; // Initialize each date with an empty array
    });

    for (let date in availableSlots) {
      let normalizedDate = date.split(",")[1].trim();

      // If there is an all-day event, skip adding any available slots for this date
      const eventsForDate = eventTimes[normalizedDate] || [];
      const hasAllDayEvent = eventsForDate.some(
        event => event.start === "12am" && event.end === "11:59pm"
      );
      if (hasAllDayEvent) {
        // No available slots for this day
        continue;
      }

      let prevEnd = startOfDay;

      if (!eventsForDate.length) {
        const slotDuration = endOfDay - prevEnd;
        if (slotDuration >= minSlotDuration) {
          availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(endOfDay) });
        }
        continue;
      }

      for (let event of eventsForDate) {
        let eventStart = timeToMinutes(event.start);

        if (eventStart > prevEnd) {
          // Ensure the slot does not extend beyond endOfDay
          const slotEnd = Math.min(eventStart, endOfDay);
          const slotDuration = slotEnd - prevEnd;
          if (prevEnd < slotEnd && slotDuration >= minSlotDuration) {
            availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(slotEnd) });
          }
        }

        prevEnd = Math.max(prevEnd, timeToMinutes(event.end));
      }

      const slotDuration = endOfDay - prevEnd;
      if (prevEnd < endOfDay && slotDuration >= minSlotDuration) {
        availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(endOfDay) });
      }
    }

    // Convert availableSlots to a readable format
    const formattedSlots = Object.entries(availableSlots)
      .filter(([date, slots]) => slots.length > 0) // Filter out dates with no available slots
      .map(([date, slots]) => {
        const formattedSlots = slots.map(slot => `${slot.start} - ${slot.end}`).join("\n");
        return `${date}\n${formattedSlots}`;
      })
      .join("\n\n");

    callback(formattedSlots); // Pass the result to the callback
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
