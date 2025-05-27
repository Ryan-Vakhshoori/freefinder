// Helper: parse plain text availability into days and slots
export function parseAvailability(text) {
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