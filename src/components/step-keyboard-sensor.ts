import type {
  Activators,
  SensorInstance,
  SensorOptions,
  SensorProps,
  UniqueIdentifier,
} from "@dnd-kit/core"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"

export type StepKeyboardSensorOptions = SensorOptions & {
  /** Where the active item lands `steps` presses down (negative: up). */
  landing(active: UniqueIdentifier, steps: number): number
  /** Called after each press that changes where the active item lands. */
  onLanding(active: UniqueIdentifier, landing: number): void
}

const PICK_UP = "Space"
/** Enter also drops, so it cannot open the editor mid-drag. */
const DROP = ["Space", "Enter"]
/** Tab cancels rather than move a session the user has left. */
const CANCEL = ["Escape", "Tab"]
const DIRECTION: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
/** Keys that would scroll the page while the item is held. */
const SCROLLING = [
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]

/**
 * Keyboard dragging in whole steps: Space picks up and drops, each up or
 * down arrow moves one step, Esc cancels. A press past the end of the range
 * is not counted, so the next press back moves at once.
 *
 * It reports steps through `onLanding` and never moves dnd-kit's
 * coordinates. dnd-kit adds every scroll of the grid to a drag, and its
 * KeyboardSensor both scrolls and moves, so on a scrolled or busy page its
 * steps came out uneven.
 */
export class StepKeyboardSensor implements SensorInstance {
  autoScrollEnabled = false
  private steps = 0

  constructor(private readonly props: SensorProps<StepKeyboardSensorOptions>) {
    props.onStart({ x: 0, y: 0 })
    document.addEventListener("keydown", this.handleKeyDown)
    window.addEventListener("resize", this.handleCancel)
    document.addEventListener("visibilitychange", this.handleCancel)
  }

  static activators: Activators<StepKeyboardSensorOptions> = [
    {
      eventName: "onKeyDown",
      handler: (event: ReactKeyboardEvent) => {
        if (event.nativeEvent.code !== PICK_UP) return false
        event.preventDefault()
        return true
      },
    },
  ]

  private handleKeyDown = (event: KeyboardEvent) => {
    // The Space press that picked the item up may still be bubbling.
    if (event === this.props.event) return
    if (DROP.includes(event.code)) return this.finish(event, this.props.onEnd)
    if (CANCEL.includes(event.code))
      return this.finish(event, this.props.onCancel)
    if (SCROLLING.includes(event.code)) return event.preventDefault()
    const direction = DIRECTION[event.code]
    if (!direction) return
    event.preventDefault()

    const { active, options } = this.props
    const landing = options.landing(active, this.steps + direction)
    if (landing === options.landing(active, this.steps)) return
    this.steps += direction
    options.onLanding(active, landing)
  }

  private handleCancel = () => this.finish(undefined, this.props.onCancel)

  private finish(event: Event | undefined, done: () => void) {
    event?.preventDefault()
    document.removeEventListener("keydown", this.handleKeyDown)
    window.removeEventListener("resize", this.handleCancel)
    document.removeEventListener("visibilitychange", this.handleCancel)
    done()
  }
}
