import {
  type DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  PointerSensor,
  type PointerSensorOptions,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  useState,
} from "react"
import { draggedStart } from "@/schedule/move"
import type { Session } from "@/schedule/schedule"
import { useSchedule } from "./schedule-provider"

/** A mouse drag starts after this much movement, so a click still opens the editor. */
const MOUSE_DRAG_DISTANCE_PX = 5
/** A finger drags after holding this long; a quicker swipe scrolls the grid. */
const TOUCH_HOLD_MS = 250
const TOUCH_HOLD_TOLERANCE_PX = 5

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
export type SessionDrag = { session: Session; start: number }

/**
 * Dragging a Day view block to move its session's start. Spread
 * `contextProps` onto the grid's `DndContext` and render a hidden element
 * with `announcerRef`.
 */
export function useSessionDrag(pxPerMinute: number) {
  const { schedule, dispatch } = useSchedule()
  const [drag, setDrag] = useState<SessionDrag | null>(null)
  // dnd-kit always mounts a live region with role "status", which would sit
  // beside the header's conflict summary. Dragging is a pointer shortcut (the
  // session dialog moves a session by keyboard) and the summary announces
  // what a drop changed, so the region is parked in a hidden element.
  const [announcer, setAnnouncer] = useState<HTMLElement | null>(null)

  const sensors = useSensors(
    useSensor(MouseAndPenSensor, {
      activationConstraint: { distance: MOUSE_DRAG_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_HOLD_MS,
        tolerance: TOUCH_HOLD_TOLERANCE_PX,
      },
    })
  )
  const landingStart = (dragged: Session, { delta }: DragMoveEvent) =>
    draggedStart(dragged.start, delta.y / pxPerMinute)

  const contextProps = {
    sensors,
    modifiers: [restrictToVerticalAxis],
    accessibility: { container: announcer ?? undefined },
    onDragStart: ({ active }: DragStartEvent) => {
      const session = schedule.find((s) => s.id === active.id)
      if (session) setDrag({ session, start: session.start })
    },
    onDragMove: (event: DragMoveEvent) =>
      setDrag((current) => {
        if (!current) return current
        const start = landingStart(current.session, event)
        return start === current.start ? current : { ...current, start }
      }),
    onDragEnd: (event: DragEndEvent) => {
      setDrag(null)
      if (!drag) return
      const start = landingStart(drag.session, event)
      if (start !== drag.session.start)
        dispatch({ type: "update", session: { ...drag.session, start } })
    },
    onDragCancel: () => {
      setDrag(null)
      swallowNextClick()
    },
  } satisfies ComponentProps<typeof DndContext>

  return { drag, contextProps, announcerRef: setAnnouncer }
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
