import { timeToMinutes, timeToMinutesMilitary, minutesToTime, removeYearFromDate } from "./utils.js"; // Import utility functions

function extractAvailability(activeView, dates, callback) {
    let events;
    if (activeView == "MONTH") {
        events = document.querySelectorAll("span.XuJrye:not([id])"); // Select calendar cells
    } else {
        events = document.querySelectorAll("div.XuJrye:not([id])"); // Select calendar cells
    }
    let eventTimes = {};

    events.forEach(event => {
        const eventText = event.textContent;

        // Include only events with at least 4 commas
        if ((eventText.match(/,/g) || []).length < 4) {
            return; // Skip this event if it has fewer than 4 commas
        }

        let eventTime = eventText.split(",")[0]; // Get the text content of the event
        let eventStartTime = eventTime.split(" ")[0]; // Extract the start time from the event text
        let eventEndTime = eventTime.split(" ")[2]; // Extract the end time from the event text
        let eventDate = removeYearFromDate(eventText.substring(eventText.lastIndexOf(",") + 1).trim()); // Extract the date from the event text and remove leading/trailing whitespace

        // Add the event start and end times to the eventTimes dictionary
        if (!eventTimes[eventDate]) {
            eventTimes[eventDate] = []; // Initialize an array for the date if it doesn't exist
        }
        eventTimes[eventDate].push({ start: eventStartTime, end: eventEndTime }); // Add the event times
    });
    let availableSlots = {};
    chrome.storage.sync.get(["startOfDay", "endOfDay", "minSlotDuration"], (data) => {
        const startOfDay = data.startOfDay ? timeToMinutesMilitary(data.startOfDay) : 0; // Default to 12:00 AM
        const endOfDay = data.endOfDay ? timeToMinutesMilitary(data.endOfDay) : timeToMinutes("23:59"); // Default to 11:59 PM
        const minSlotDuration = data.minSlotDuration ? data.minSlotDuration : 0; // Default to 0 minutes

        dates.forEach(date => {
            availableSlots[date] = []; // Initialize each date with an empty array
        });

        for (let date in availableSlots) {
            let normalizedDate = date.split(",")[1].trim(); // Remove the day of the week (e.g., "Sunday, 6 April" -> "6 April")
            let prevEnd = startOfDay;

            if (!eventTimes[normalizedDate]) {
                const slotDuration = endOfDay - prevEnd;
                if (slotDuration >= minSlotDuration) {
                    availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(endOfDay) });
                }
                continue;
            }

            for (let event of eventTimes[normalizedDate]) {
                let eventStart = timeToMinutes(event.start);

                if (eventStart > prevEnd) {
                    // Ensure the slot does not extend beyond endOfDay
                    const slotEnd = Math.min(eventStart, endOfDay);
                    const slotDuration = slotEnd - prevEnd;
                    if (prevEnd < slotEnd && slotDuration >= minSlotDuration) {
                        availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(slotEnd) });
                    }
                }

                prevEnd = Math.max(prevEnd, timeToMinutes(event.end)); // Update prevEnd to the end of the current event
            }

            const slotDuration = endOfDay - prevEnd;
            // Check for availability after the last event, but ensure it ends at endOfDay
            if (prevEnd < endOfDay && slotDuration >= minSlotDuration) {
                availableSlots[date].push({ start: minutesToTime(prevEnd), end: minutesToTime(endOfDay) });
            }
        }

        // Convert availableSlots to a readable format
        const formattedSlots = Object.entries(availableSlots)
            .filter(([date, slots]) => slots.length > 0) // Filter out dates with no available slots
            .map(([date, slots]) => {
                const formattedSlots = slots.map(slot => `${slot.start} - ${slot.end}`).join("\n");
                return `${date}:\n${formattedSlots}`;
            })
            .join("\n\n");

        callback(formattedSlots); // Pass the result to the callback
    });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAvailability") {
        const [ activeView, dates ] = extractDates(); // Call the function to extract dates
        if (dates.length === 0) {
            sendResponse({ data: "Unsupported view" });
            return;
        }
        extractAvailability(activeView, dates, (availability) => { // Call the function to extract availability
            sendResponse({ data: availability });
        });
        return true; // Keep the message channel open for sendResponse
    }
});

function extractDates() {
    const activeViewDiv = document.querySelector('body[data-viewkey]');
    const activeView = activeViewDiv.getAttribute('data-viewkey'); // Log the active view element
    if (activeView == "DAY") {
        let date = document.querySelector('title').textContent; // Extract the date from the title
        if (date.includes(", today")) {
            date = date.replace(", today", ""); // Remove ", today" if it exists
        }
        date = removeYearFromDate(date.replace("Google Calendar - ", ""));// Remove the prefix from the title
        return [ activeView, [date] ]; // Return the date without the year
    } else if (activeView == "WEEK" || activeView == "CUSTOM_DAYS") {
        const dayElements = document.querySelectorAll('h2.hI2jVc'); // Select all day elements
        const dates = Array.from(dayElements).map(day => {
            let date = day.getAttribute('aria-label'); // Extract the date
            if (date.includes(", today")) {
                date = date.replace(", today", ""); // Remove ", today" if it exists
            }
            return date; // Return the cleaned date
        });
        return [ activeView, dates ]; // Return the array of dates
    } else if (activeView == "MONTH") {
        const dayElements = document.querySelectorAll('h2.CqwSk.XuJrye'); // Select all day elements
        const dates = Array.from(dayElements).map(day => {
            let date = day.textContent; // Extract the date
            if (date.includes(", today")) {
                date = date.replace(", today", ""); // Remove ", today" if it exists
            }
            // Remove the "X events, " prefix
            date = date.replace(/^\d+ events?, /, ""); // Remove "1 event, " or "0 events, "
            return date; // Return the cleaned date in the form "Sunday, 6 April"
        });
        return [ activeView, dates ]; // Return the array of cleaned dates
    } else {
        return [ activeView, [] ]; // Return an empty array if the view is not DAY, WEEK, or MONTH
    }
}
