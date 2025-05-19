# Availability Finder for Google Calendar

A Chrome extension that extracts and displays your availability from Google Calendar, making it easy to find free time slots for scheduling.

## Features

- Extracts and displays available time slots directly from Google Calendar.
- Customizable workday start/end times and minimum slot duration.
- Persistent user settings using Chrome Storage API.
- User-friendly popup UI built with JavaScript, HTML, and CSS.

## Installation

**Recommended:**  
Install directly from the Chrome Web Store:  
[Availability Finder for Google Calendar](https://chromewebstore.google.com/detail/availability-finder-for-g/cocgggflifjnhegpnacnobohkmfmdfhe?authuser=0&hl=en-GB)

**For development:**
1. Clone the repository:
    ```sh
    git clone https://github.com/ryanvakhshoori/gcal-availability-finder.git
    ```
2. Open terminal in the `gcal-availability-finder` directory.
3. Run `npm install`.
4. Run `npx webpack`.
5. Open Google Chrome.
6. Go to `chrome://extensions/`.
7. Enable Developer mode.
8. Click **Load unpacked** and select the project directory as the extension directory.

## Usage

1. Open Google Calendar in Chrome.
2. Click the extension icon in the Chrome toolbar.
3. View your available time slots and adjust settings as needed.

---
