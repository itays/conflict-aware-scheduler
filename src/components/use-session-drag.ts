import {
  type DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  getClientRect,
  getScrollableAncestors,
  PointerSensor,
  type PointerSensorOptions,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  useId,
  useState,
} from "react"
import { plural } from "@/lib/utils"
import { draggedStart, MOVE_STEP_MINUTES } from "@/schedule/move"
import { LAST_START, overlapsWith, type Session } from "@/schedule/schedule"
import { formatTime } from "@/schedule/time"
import { useSchedule } from "./schedule-provider"
import { StepKeyboardSensor } from "./step-keyboard-sensor"

/** A mouse drag starts after this much movement, so a click still opens the editor. */
const MOUSE_DRAG_DISTANCE_PX = 5
/** A finger drags after holding this long; a quicker swipe scrolls the grid. */
const TOUCH_HOLD_MS = 250
const TOUCH_HOLD_TOLERANCE_PX = 5

const KEYBOARD_INSTRUCTIONS = `Press Space to pick up, the up and down arrows to move ${MOVE_STEP_MINUTES} minutes, Space to drop and Escape to cancel.`

/** Mouse and pen only: touch goes to TouchSensor and its hold delay. */
class MouseAndPenSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (event: ReactPointerEvent, options: PointerSensorOptions) =>
        event.nativeEvent.pointerType !== "touch" &&
        PointerSensor.activators[0].handler(event, options),
    },
  ]
}

/** A session being dragged and the start it would land on. */
export type SessionDrag = {
  session: Session
  start: number
  /** Arrow presses set `start`; dnd-kit's drag distance is ignored. */
  byKeyboard: boolean
}

/**
 * Dragging a Day view block to move its session's start, by pointer or by
 * keyboard. Spread `contextProps` onto the grid's `DndContext`, render a
 * hidden element with `announcerRef`, and render `announcement` in a live
 * region.
 */
export function useSessionDrag(pxPerMinute: number) {
  const { schedule, dispatch } = useSchedule()
  const [drag, setDrag] = useState<SessionDrag | null>(null)
  const [announcement, setAnnouncement] = useState("")
  // dnd-kit always mounts a live region with role "status", which would sit
  // beside the header's conflict summary. It is parked in a hidden element,
  // and the Day view announces drags in its own live region instead.
  const [announcer, setAnnouncer] = useState<HTMLElement | null>(null)

  const landingStart = (session: Session, deltaY: number) =>
    draggedStart(session.start, deltaY / pxPerMinute)
  const sessionById = (id: UniqueIdentifier) =>
    schedule.find((s) => s.id === id)

  const sensors = useSensors(
    useSensor(MouseAndPenSensor, {
      activationConstraint: { distance: MOUSE_DRAG_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_HOLD_MS,
        tolerance: TOUCH_HOLD_TOLERANCE_PX,
      },
    }),
    useSensor(StepKeyboardSensor, {
      landing: (id, steps) => {
        const session = sessionById(id)
        return session
          ? draggedStart(session.start, steps * MOVE_STEP_MINUTES)
          : 0
      },
      onLanding: (id, start) => {
        const session = sessionById(id)
        if (!session) return
        setDrag((current) => current && { ...current, start })
        setAnnouncement(moveAnnouncement(session, start))
      },
    })
  )

  const contextProps = {
    // dnd-kit numbers its ids with a module counter, which differs between
    // the server render and the client, so the blocks' aria-describedby
    // would point at no element.
    id: useId(),
    sensors,
    modifiers: [restrictToVerticalAxis],
    measuring: { draggable: { measure: measureIgnoringScroll } },
    accessibility: {
      container: announcer ?? undefined,
      screenReaderInstructions: { draggable: KEYBOARD_INSTRUCTIONS },
    },
    onDragStart: ({ active, activatorEvent }: DragStartEvent) => {
      const session = sessionById(active.id)
      if (!session) return
      setDrag({
        session,
        start: session.start,
        byKeyboard: activatorEvent instanceof KeyboardEvent,
      })
      setAnnouncement(
        `Picked up ${session.title} at ${formatTime(session.start)}`
      )
    },
    onDragMove: ({ delta }: DragMoveEvent) => {
      if (!drag || drag.byKeyboard) return
      const start = landingStart(drag.session, delta.y)
      if (start === drag.start) return
      setDrag({ ...drag, start })
    },
    onDragEnd: ({ delta }: DragEndEvent) => {
      setDrag(null)
      if (!drag) return
      const moved = {
        ...drag.session,
        start: drag.byKeyboard
          ? drag.start
          : landingStart(drag.session, delta.y),
      }
      if (moved.start !== drag.session.start)
        dispatch({ type: "update", session: moved })
      setAnnouncement(dropAnnouncement(drag.session, moved, schedule))
    },
    onDragCancel: () => {
      setDrag(null)
      if (!drag) return
      setAnnouncement(
        `Move cancelled. ${drag.session.title} stays at ${formatTime(drag.session.start)}`
      )
      if (!drag.byKeyboard) swallowNextClick()
    },
  } satisfies ComponentProps<typeof DndContext>

  return { drag, contextProps, announcerRef: setAnnouncer, announcement }
}

/**
 * A block's rect with its scrolled ancestors' offsets added back. dnd-kit
 * re-measures the dragged block when it resizes, as it does on changing
 * lanes, and counts any change in its rect as the block moving. A viewport
 * rect changes with every scroll that dnd-kit already adds to the drag, so
 * a drag that had scrolled the grid jumped on its next lane change.
 */
function measureIgnoringScroll(node: HTMLElement) {
  const rect = getClientRect(node, { ignoreTransform: true })
  const scrolled = getScrollableAncestors(node).reduce(
    (sum, ancestor) => sum + ancestor.scrollTop,
    0
  )
  return { ...rect, top: rect.top + scrolled, bottom: rect.bottom + scrolled }
}

/**
 * "Hiring sync at 10:45", read after each arrow press. Pointer drags stay
 * quiet between pick-up and drop.
 */
function moveAnnouncement(session: Session, start: number): string {
  const limit =
    start === 0
      ? ", the earliest start"
      : start === LAST_START
        ? ", the latest start"
        : ""
  return `${session.title} at ${formatTime(start)}${limit}`
}

/** "Hiring sync moved to 11:00, overlaps 2 sessions". */
function dropAnnouncement(
  before: Session,
  after: Session,
  schedule: readonly Session[]
): string {
  const count = overlapsWith(schedule, after).length
  const overlaps =
    count === 0 ? "no overlaps" : `overlaps ${plural(count, "session")}`
  const verb = after.start === before.start ? "stays at" : "moved to"
  return `${after.title} ${verb} ${formatTime(after.start)}, ${overlaps}`
}

/**
 * After Esc the block snaps back under the pointer, and dnd-kit stops
 * blocking clicks 50ms later, so releasing would open the editor. This
 * swallows that click, or gives up at the next press if none comes.
 */
function swallowNextClick() {
  const swallow = (event: Event) => event.stopPropagation()
  window.addEventListener("click", swallow, { capture: true, once: true })
  window.addEventListener(
    "pointerdown",
    () => window.removeEventListener("click", swallow, { capture: true }),
    { capture: true, once: true }
  )
}
