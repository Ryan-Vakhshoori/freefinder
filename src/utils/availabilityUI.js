import feather from 'feather-icons';
import { copyWithFeedback } from './clipboardUtils.js';

export function renderAvailability(days) {
  const availabilityDays = document.getElementById("availabilityDays");
  availabilityDays.innerHTML = ""; // Clear previous

  days.forEach(day => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-component";

    // Header
    const header = document.createElement("div");
    header.className = "day-header";

    // Title (left)
    const title = document.createElement("span");
    title.className = "day-title";
    title.textContent = day.date;

    // Right-side controls (copy + expand)
    const rightControls = document.createElement("div");
    rightControls.className = "right-controls";

    // Copy Day button
    const copyDayBtn = document.createElement("button");
    copyDayBtn.className = "copy-day-btn";
    copyDayBtn.title = "Copy all slots for this day";
    copyDayBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
    copyDayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = `${day.date}\n${day.slots.join("\n")}`;
      copyWithFeedback(copyDayBtn, text, 16);
    });

    // Expand/Collapse button (icon)
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-btn";
    toggleBtn.title = "Expand/Collapse";
    toggleBtn.innerHTML = feather.icons['chevron-up'].toSvg({ width: 18, height: 18 }); // Default to expanded

    let expanded = true; // Default to expanded
    const slotsDiv = document.createElement("div");
    slotsDiv.className = "day-slots";
    // slotsDiv.style.display = "block"; // Show slots by default

    // Toggle logic for button
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering expand/collapse from header click
      expanded = !expanded;
      slotsDiv.classList.toggle("collapsed", !expanded);
      toggleBtn.innerHTML = expanded
        ? feather.icons['chevron-up'].toSvg({ width: 18, height: 18 })
        : feather.icons['chevron-down'].toSvg({ width: 18, height: 18 });
    });

    // Also allow clicking the entire day component to expand/collapse
    dayDiv.addEventListener("click", (e) => {
      if (
        e.target !== copyDayBtn &&
        e.target !== toggleBtn &&
        !copyDayBtn.contains(e.target) &&
        !toggleBtn.contains(e.target)
      ) {
        expanded = !expanded;
        slotsDiv.classList.toggle("collapsed", !expanded);
        toggleBtn.innerHTML = expanded
          ? feather.icons['chevron-up'].toSvg({ width: 18, height: 18 })
          : feather.icons['chevron-down'].toSvg({ width: 18, height: 18 });
      }
    });

    // Add controls to rightControls container
    rightControls.appendChild(copyDayBtn);
    rightControls.appendChild(toggleBtn);

    // Add left and right to header
    header.appendChild(title);
    header.appendChild(rightControls);

    day.slots.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "slot";

      const slotSpan = document.createElement("span");
      slotSpan.textContent = slot;

      // For each slot copy button
      const copySlotBtn = document.createElement("button");
      copySlotBtn.className = "copy-slot-btn";
      copySlotBtn.title = "Copy this slot";
      copySlotBtn.innerHTML = feather.icons.copy.toSvg({ width: 16, height: 16 });
      copySlotBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = `${day.date}\n${slot}`;
        copyWithFeedback(copySlotBtn, text, 16);
      });

      slotDiv.appendChild(slotSpan);
      slotDiv.appendChild(copySlotBtn);
      slotsDiv.appendChild(slotDiv);
    });

    dayDiv.appendChild(header);
    dayDiv.appendChild(slotsDiv);
    availabilityDays.appendChild(dayDiv);
  });
}