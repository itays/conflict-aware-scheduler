import { MINUTES_PER_DAY } from "./schedule"

const pad = (value: number) => String(value).padStart(2, "0")

/** 24-hour HH:mm. The end of the day reads "24:00"; later minutes wrap. */
export function formatTime(minutes: number): string {
  if (minutes === MINUTES_PER_DAY) return "24:00"
  const ofDay = minutes % MINUTES_PER_DAY
  return `${pad(Math.floor(ofDay / 60))}:${pad(ofDay % 60)}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 120) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
