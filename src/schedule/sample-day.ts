import type { Schedule } from "./schedule"

/**
 * The day from the design boards: back-to-back sessions in the morning, a
 * three-session conflict before lunch, a two-session conflict after it, and
 * an on-call handoff running past midnight.
 */
export function sampleDay(): Schedule {
  return [
    { id: "standup", title: "Standup sync", start: 510, duration: 30 },
    {
      id: "phone-screen",
      title: "Phone screen — Maya Cohen",
      start: 540,
      duration: 60,
    },
    {
      id: "system-design",
      title: "System design — Omer Levi",
      start: 600,
      duration: 60,
    },
    { id: "hiring-sync", title: "Hiring sync", start: 630, duration: 45 },
    { id: "room-hold", title: "Room 4B hold", start: 645, duration: 45 },
    { id: "lunch", title: "Lunch with candidate", start: 720, duration: 60 },
    { id: "culture", title: "Culture interview", start: 810, duration: 45 },
    { id: "debrief", title: "Recruiter debrief", start: 840, duration: 30 },
    {
      id: "take-home",
      title: "Take-home review — Noa B.",
      start: 900,
      duration: 90,
    },
    { id: "wrap-up", title: "Panel wrap-up", start: 1020, duration: 45 },
    { id: "on-call", title: "On-call handoff", start: 1410, duration: 60 },
  ]
}
