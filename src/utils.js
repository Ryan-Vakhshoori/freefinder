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