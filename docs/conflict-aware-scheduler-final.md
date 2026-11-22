# Front-End Take-Home Challenge: “Conflict-Aware Scheduler”

Build a small single-page app that lets a user schedule sessions (such as interviews, appointments, or room bookings) into a day view, with **conflict detection** as the core feature.

**Time box:** About 4 hours. We would rather see a small, polished, well-reasoned piece of work than an exhaustive one. When you hit the limit, stop and use the README to tell us what you would do next.

There is deliberately no provided design or detailed spec. Make the product decisions you think are right, and be prepared to defend them.

## Core Requirements

The app should:

- Display a day’s schedule as a timeline or list.
- Let the user add, edit, and delete sessions, each with a title, start time, and duration.
- Detect and clearly communicate overlapping sessions. The UI should help the user understand what conflicts and make it easy to resolve.
- Handle the awkward cases gracefully: invalid input, back-to-back sessions, sessions crossing midnight, an empty schedule, and a very crowded one.

## Pick ONE Extension

Choose one of the following:

- **Timezone support:** Schedule spans timezones; display and conflicts must stay correct.
- **Drag-and-drop:** Rearrange sessions by dragging, with conflicts updating live.
- **Persistence + undo/redo:** Survive page reloads, with a proper undo history.
- **Accessibility deep-dive:** Full keyboard operability, screen-reader-friendly conflict announcements, and visible focus management.
- **Something else that shows your strengths:** Tell us in the README why you chose it.

## Rules and Guidance

- **Tools are your choice:** Use any framework, libraries, and tooling you like. No backend is required; mock data in memory or local storage is fine.
- **Running the app:** The app must run with a single command (`npm install && npm start` or equivalent).
- **Tests:** Write tests for the parts you consider most important. We care more about what you chose to test than coverage numbers.
- **AI assistance:** AI tools are welcome; we use them too. Feel free to use Claude, Copilot, Cursor, or a similar tool as you would at work. Include a short note in the README explaining where and how you used AI assistance, if at all. At the onsite follow-up interview, we will go through your solution together. Be ready to explain every line as if you wrote it by hand and to extend the app live.
- **Questions and assumptions:** Questions are encouraged. If something is unclear, email [Name] and myself. If you would rather keep moving, write down your assumption and continue.

## Deliverables

Send a GitHub repository link or a zip file containing:

- The working app and its source code.
- Your tests.
- A short `README.md` covering:
  - Instructions for running the app.
  - The product and technical decisions you made, and why.
  - What you deliberately left out or cut to fit the time box.
  - One thing about your solution you are proud of, and one you would redo.
  - Where and how you used AI assistance, if at all.
  - What you would do next with more time.
  - Why you chose your extension, if you selected something outside the listed options.

## Submission Timeline

Please aim to submit within **2 to 3 days**. If you need more time, that is fine; just let us know when to expect it.

## What We Will Evaluate

- **Quality of work:** Tests and thoughtful use of technology. We will ask why you chose it.
- **Solution:** Does it work, and does it do the job?
- **Product judgment:** The decisions you made around conflicts and edge cases, and how you defend them.
- **Extension:** Why you chose it, and how well you executed it.
- **Next steps:** If you had more time, what other ideas would you experiment with?
- **Growth:** What other considerations would you apply to scale this?
