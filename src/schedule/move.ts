import { LAST_START } from "./schedule"

/** A drag, or one arrow press, moves a session's start this many minutes. */
export const MOVE_STEP_MINUTES = 15

/**
 * The start a session lands on when dragged `minutes` away from `start`:
 * whole 15-minute steps from `start`, so 10:05 moves to 10:20 or 09:50,
 * held between 00:00 and 23:55 (ADR 0002).
 */
export function draggedStart(start: number, minutes: number): number {
  const steps = Math.round(minutes / MOVE_STEP_MINUTES)
  return Math.min(Math.max(start + steps * MOVE_STEP_MINUTES, 0), LAST_START)
}
