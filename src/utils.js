export function timeToMinutes(time) {
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

export function timeToMinutesMilitary(time) {
    let [hours, minutes] = time.split(":").map(Number); // Split the time into hours and minutes
    return hours * 60 + minutes; // Return total minutes
}

export function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? "pm" : "am";
    const formattedHours = (hours % 12) || 12; // Convert to 12-hour format
    return `${formattedHours}:${mins.toString().padStart(2, '0')}${period}`;
}

export function removeYearFromDate(date) {
    const dateParts = date.split(" ");
    return dateParts.slice(0, -1).join(" "); // Remove the last part (year) and join the rest
}

export function extractDate(eventString) {
    // Match patterns like:
    // - April 16, 2025
    // - 17 April 2025
    const dateRegex = /(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})$/i;

    const match = eventString.match(dateRegex);
    if (!match) return null;

    let date = match[0].replace(/,\s*/, ' '); // Remove any commas
    const parts = date.split(" ");

    // Normalize to "Day Month" format (remove the year)
    if (!isNaN(parts[0])) {
        // If the date starts with a number (e.g., "17 April 2025"), rearrange it to "Day Month"
        date = `${parts[0]} ${parts[1]}`;
    } else {
        // If the date starts with the month (e.g., "April 16, 2025"), rearrange it to "Day Month"
        date = `${parts[1]} ${parts[0]}`;
    }

    return date;
}

export function normalizeDateString(dateString) {
    // Match patterns for various date formats
    const dateRegex = /(?:Google Calendar - )?(?:(?:\d+ events?|No events), )?(?<dayOfWeek>\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)?,?\s*(?:(?<month>\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b)\s*(?<day>\d{1,2})|(?<dayAlt>\d{1,2})\s*(?<monthAlt>\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b))?,?\s*(?<year>\d{4})?(?:, today)?/i;

    const match = dateString.match(dateRegex);
    if (!match || !match.groups) return null;

    // Extract components from the match
    const { dayOfWeek, month, day, dayAlt, monthAlt } = match.groups;

    // Normalize the day and month
    const normalizedDay = day || dayAlt;
    const normalizedMonth = month || monthAlt;

    // Ensure all parts are present
    if (!normalizedDay || !normalizedMonth) return null;

    // Format the result as "day of week, day, month"
    return `${dayOfWeek || ""}${dayOfWeek ? ", " : ""}${normalizedDay} ${normalizedMonth}`;
}
