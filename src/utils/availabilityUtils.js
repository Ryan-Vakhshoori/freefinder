import { timeToMinutes, minutesToTime } from "./timeUtils";

// Helper: parse plain text availability into days and slots
export function slotsToPoints(days, interval, minSlotDuration = 0) {
  days.forEach(day => {
    const points = [];
    day.slots.forEach(slot => {
      const [startStr, endStr] = slot.split(" - ");
      let start = timeToMinutes(startStr);
      let end = timeToMinutes(endStr);

      // Only generate points if the slot is at least minSlotDuration long
      if (end - start >= minSlotDuration) {
        // Find the first time point >= start that aligns with the interval
        let firstPoint = Math.ceil(start / interval) * interval;
        for (let t = firstPoint; t < end; t += interval) {
          // Only include points that leave at least minSlotDuration after them
          if (end - t >= minSlotDuration) {
            points.push(minutesToTime(t));
          }
        }
      }
    });
    day.slots = points;
  });
  
  return days;
}