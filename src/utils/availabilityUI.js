import feather from 'feather-icons';

let selectedSlots = [];
let isBatchSelecting = false;
let isDayBatchSelecting = false;

function parseSlotKey(slotKey) {
  const [date, ...slotParts] = slotKey.split('\n');
  const slot = slotParts.join('\n');
  return { date, slot };
}

function getTimeFromSlot(slot) {
  const match = slot.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  let minute = match[2] ? parseInt(match[2], 10) : 0;
  let ampm = match[3] ? match[3].toLowerCase() : null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function parseDateString(dateStr) {
  const year = new Date().getFullYear();
  let d = Date.parse(`${dateStr} ${year}`);
  if (isNaN(d)) {
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      d = Date.parse(`${parts[1]} ${parts[0]} ${year}`);
    }
  }
  return d;
}

function updateClipboardAndFeedback() {
  const parsed = selectedSlots.map(parseSlotKey);
  parsed.sort((a, b) => {
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);
    if (dateA !== dateB) return dateA - dateB;
    return getTimeFromSlot(a.slot) - getTimeFromSlot(b.slot);
  });

  const grouped = {};
  parsed.forEach(({ date, slot }) => {
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(slot);
  });

  const lines = [];
  Object.entries(grouped).forEach(([date, slots]) => {
    lines.push(date);
    slots.forEach(slot => lines.push(slot));
  });

  navigator.clipboard.writeText(lines.join('\n'));
}

export function renderAvailability(days) {
  const availabilityDays = document.getElementById("availabilityDays");
  availabilityDays.innerHTML = "";
  selectedSlots = [];

  // --- Select All: Use dateRange ---
  const headerContainer = document.getElementById("headerContainer");
  const dateRange = document.getElementById("dateRange");
  headerContainer.style.cursor = "default";
  dateRange.style.cursor = "pointer";

  // Track all slot divs for select all logic
  const allSlotDivs = [];

  // --- Days ---
  days.forEach(day => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-component";

    // Header
    const header = document.createElement("div");
    header.className = "day-header";
    header.style.cursor = "pointer";

    const title = document.createElement("span");
    title.className = "day-title";
    title.textContent = day.date;

    // Right-side controls (expand)
    const rightControls = document.createElement("div");
    rightControls.className = "right-controls";

    // Expand/Collapse button (icon)
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-btn";
    toggleBtn.title = "Expand/Collapse";
    toggleBtn.innerHTML = feather.icons['chevron-up'].toSvg({ width: 18, height: 18 });

    let expanded = true;
    const slotsDiv = document.createElement("div");
    slotsDiv.className = "day-slots";

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      expanded = !expanded;
      if (expanded) {
        slotsDiv.classList.remove("hidden");
        header.classList.remove("collapsed");
      }
      else {
        slotsDiv.classList.add("hidden");
        header.classList.add("collapsed");
      }
      toggleBtn.innerHTML = expanded
        ? feather.icons['chevron-up'].toSvg({ width: 18, height: 18 })
        : feather.icons['chevron-down'].toSvg({ width: 18, height: 18 });
    });

    rightControls.appendChild(toggleBtn);
    header.appendChild(title);
    header.appendChild(rightControls);

    // Track slot divs for this day
    const slotDivs = [];

    day.slots.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "slot";
      slotDiv.style.cursor = "pointer";

      const slotSpan = document.createElement("span");
      slotSpan.textContent = slot;

      const slotKey = `${day.date}\n${slot}`;

      // Slot click handler
      slotDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = selectedSlots.indexOf(slotKey);
        if (idx === -1) {
          selectedSlots.push(slotKey);
          slotDiv.classList.add("selected");
        } else {
          selectedSlots.splice(idx, 1);
          slotDiv.classList.remove("selected");
        }
        // Update day and select all visual state
        updateDaySelection();
        updateSelectAllSelection();
        updateClipboardAndFeedback();
      });

      slotDivs.push(slotDiv);
      allSlotDivs.push(slotDiv);

      slotDiv.appendChild(slotSpan);
      slotsDiv.appendChild(slotDiv);
    });

    // Day header click: select/deselect all slots for this day
    header.addEventListener("click", (e) => {
      if (e.target === toggleBtn) return;
      const allSelected = slotDivs.every(div => div.classList.contains("selected"));
      slotDivs.forEach((div, i) => {
        const slotKey = `${day.date}\n${day.slots[i]}`;
        if (!allSelected) {
          if (!selectedSlots.includes(slotKey)) selectedSlots.push(slotKey);
          div.classList.add("selected");
        } else {
          const idx = selectedSlots.indexOf(slotKey);
          if (idx !== -1) selectedSlots.splice(idx, 1);
          div.classList.remove("selected");
        }
      });
      updateDaySelection();
      updateSelectAllSelection();
      updateClipboardAndFeedback();
    });

    // Helper to update day header visual state
    function updateDaySelection() {
      const allSelected = slotDivs.every(div => div.classList.contains("selected"));
      if (allSelected) {
        header.classList.add("selected");
      } else {
        header.classList.remove("selected");
      }
    }

    dayDiv.appendChild(header);
    dayDiv.appendChild(slotsDiv);
    availabilityDays.appendChild(dayDiv);
  });

  // Select All click: select/deselect all slots in all days
  dateRange.onclick = function (e) {
    // Prevent toggling if clicking on a child button (like expand/collapse)
    if (e.target.closest('.toggle-btn')) return;
    const allSelected = allSlotDivs.every(div => div.classList.contains("selected"));
    allSlotDivs.forEach((div, i) => {
      const slotKey = (() => {
        let dayDiv = div.parentNode.parentNode;
        let date = dayDiv.querySelector('.day-title').textContent;
        let slot = div.querySelector('span').textContent;
        return `${date}\n${slot}`;
      })();
      if (!allSelected) {
        if (!selectedSlots.includes(slotKey)) selectedSlots.push(slotKey);
        div.classList.add("selected");
      } else {
        const idx = selectedSlots.indexOf(slotKey);
        if (idx !== -1) selectedSlots.splice(idx, 1);
        div.classList.remove("selected");
      }
    });
    // Update all day headers
    document.querySelectorAll('.day-header').forEach(header => {
      const slots = header.parentNode.querySelectorAll('.slot');
      const allSelected = Array.from(slots).every(div => div.classList.contains("selected"));
      if (allSelected) header.classList.add("selected");
      else header.classList.remove("selected");
    });
    updateClipboardAndFeedback();
    updateSelectAllSelection();
  };

  // Helper to update select all visual state
  function updateSelectAllSelection() {
    const allSelected = allSlotDivs.every(div => div.classList.contains("selected"));
    if (allSelected) dateRange.classList.add("selected");
    else dateRange.classList.remove("selected");
  }
}