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

function timeToMinutes(time) {
    const timeStr = time.slice(0, -2); // Extract the time part (e.g., "6" or "6:30")
    const period = time.slice(-2); // Extract the period ("am" or "pm")
    let [hours, minutes] = timeStr.includes(":") ? timeStr.split(":").map(Number) : [Number(timeStr), 0]; // Handle missing minutes

    if (period === "pm" && hours !== 12) {
        hours += 12; // Convert PM times to 24-hour format (except 12 PM, which is the same)
    }
    if (period === "am" && hours === 12) {
        hours = 0; // Convert 12 AM to 00:00 in 24-hour format
    }
    return hours * 60 + minutes; // Return total minutes
}

function timeToMinutesMilitary(time) {
    let [hours, minutes] = time.split(":").map(Number); // Split the time into hours and minutes
    return hours * 60 + minutes; // Return total minutes
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? "pm" : "am";
    const formattedHours = (hours % 12) || 12; // Convert to 12-hour format
    return `${formattedHours}:${mins.toString().padStart(2, '0')}${period}`;
}

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
    } else if (activeView == "WEEK") {
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

function removeYearFromDate(date) {
    const dateParts = date.split(" ");
    return dateParts.slice(0, -1).join(" "); // Remove the last part (year) and join the rest
}