import { MINUTES_PER_DAY } from "./schedule"

/** What the session dialog holds while the user types: raw field text. */
export type SessionDraft = {
  title: string
  start: string
  duration: string
}

export type SessionFields = { title: string; start: number; duration: number }

export type DraftErrors = Partial<Record<keyof SessionDraft, string>>

export type DraftResult =
  | { ok: true; value: SessionFields }
  | { ok: false; errors: DraftErrors }

export const MAX_TITLE_LENGTH = 80
const STEP_MINUTES = 5
const LAST_START = MINUTES_PER_DAY - STEP_MINUTES

/** Minutes from midnight for a 24-hour "H:mm" or "HH:mm" time of day. */
export function parseTime(text: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 60 + minutes
}

function titleError(title: string): string | undefined {
  if (title === "") return "Enter a title."
  if (title.length > MAX_TITLE_LENGTH)
    return `Keep the title to ${MAX_TITLE_LENGTH} characters or fewer.`
}

function startError(start: number | undefined): string | undefined {
  if (start === undefined || start > LAST_START)
    return "Enter a time as HH:mm, from 00:00 to 23:55."
  if (start % STEP_MINUTES !== 0)
    return "Start on a 5-minute step, such as 09:00 or 09:05."
}

function parseDuration(text: string): number | undefined {
  if (!/^\d+$/.test(text.trim())) return undefined
  const minutes = Number(text)
  const valid =
    minutes >= STEP_MINUTES &&
    minutes <= MINUTES_PER_DAY &&
    minutes % STEP_MINUTES === 0
  return valid ? minutes : undefined
}

/** The draft's start and duration once both are valid, whatever the title. */
export function draftTiming(
  draft: SessionDraft
): { start: number; duration: number } | undefined {
  const start = parseTime(draft.start)
  const duration = parseDuration(draft.duration)
  if (start === undefined || startError(start) || duration === undefined)
    return undefined
  return { start, duration }
}

/**
 * Checks the draft on its own. Overlaps with other sessions never make a
 * draft invalid (ADR 0001), and neither does a duplicate title.
 */
export function validateSessionDraft(draft: SessionDraft): DraftResult {
  const title = draft.title.trim()
  const timing = draftTiming(draft)
  const errors: DraftErrors = {
    title: titleError(title),
    start: startError(parseTime(draft.start)),
    duration:
      parseDuration(draft.duration) === undefined
        ? "Use 5 minutes to 24 hours, in 5-minute steps."
        : undefined,
  }
  if (errors.title || !timing)
    return {
      ok: false,
      errors: Object.fromEntries(
        Object.entries(errors).filter(([, message]) => message)
      ),
    }
  return { ok: true, value: { title, ...timing } }
}
