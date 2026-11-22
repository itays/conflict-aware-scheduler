import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CalendarDaysIcon, PlusIcon } from "lucide-react"
import { useRef, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import type { Session } from "@/schedule/schedule"
import { AgendaView } from "./agenda-view"
import { ConflictSummary } from "./conflict-summary"
import { DayView } from "./day-view"
import { ModeToggle } from "./mode-toggle"
import { useSchedule } from "./schedule-provider"
import { SessionDialog } from "./session-dialog"

export const viewSearchSchema = z.object({
  view: z.enum(["day", "agenda"]).default("day").catch("day"),
  /**
   * The conflict in focus, as the comma-joined ids of its sessions: the
   * Agenda shows only it, the Day view highlights it.
   */
  conflict: z.string().optional().catch(undefined),
})

export type View = z.infer<typeof viewSearchSchema>["view"]

export const conflictParam = (sessions: readonly Session[]) =>
  sessions.map((s) => s.id).join(",")

export const focusedSessionIds = (conflict: string | undefined) =>
  conflict?.split(",").filter(Boolean)

/** Sessions whose conflicts a view focuses on: filtered or highlighted. */
export type ConflictFocus = { focus?: string[] }

/** The element standing for a session in whichever view is showing. */
export const sessionElement = (id: string) =>
  document.querySelector<HTMLElement>(`[data-session-id="${id}"]`)

/** How a view asks the page to open the session dialog. */
export type SessionEditing = {
  onAddSession: (opener: HTMLElement) => void
  onEditSession: (session: Session, opener: HTMLElement) => void
}

export function SchedulerPage({
  view,
  conflict,
}: {
  view: View
  conflict?: string
}) {
  const focus = focusedSessionIds(conflict)
  const { dispatch } = useSchedule()
  // `key` remounts the form on every opening; `session` outlives `open` so
  // the dialog keeps its content while it animates closed.
  const [dialog, setDialog] = useState<{
    open: boolean
    key: number
    session?: Session
  }>({ open: false, key: 0 })
  const opener = useRef<HTMLElement | null>(null)
  const newSessionButton = useRef<HTMLButtonElement>(null)
  // A save can remount the opener (an Agenda row that joins a conflict) and
  // a delete removes it, so fall back to the session's new element, then to
  // "New session".
  const returnFocusTo = () => {
    if (opener.current?.isConnected) return opener.current
    const id = dialog.session?.id
    const moved = id ? sessionElement(id) : null
    return moved ?? newSessionButton.current
  }

  const openDialog = (from: HTMLElement, session?: Session) => {
    opener.current = from
    setDialog((current) => ({ open: true, key: current.key + 1, session }))
  }
  const editing: SessionEditing = {
    onAddSession: (from) => openDialog(from),
    onEditSession: (session, from) => openDialog(from, session),
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <h1 className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDaysIcon aria-hidden className="size-4" />
          </span>
          Scheduler
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConflictSummary />
          <ViewSwitch view={view} />
          <Button variant="outline" onClick={() => dispatch({ type: "clear" })}>
            Clear day
          </Button>
          <Button
            ref={newSessionButton}
            onClick={(event) => openDialog(event.currentTarget)}
          >
            <PlusIcon aria-hidden />
            New session
          </Button>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {view === "agenda" ? (
          <AgendaView {...editing} focus={focus} />
        ) : (
          <DayView {...editing} focus={focus} />
        )}
      </main>
      <SessionDialog
        key={dialog.key}
        open={dialog.open}
        session={dialog.session}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        returnFocusTo={returnFocusTo}
      />
    </div>
  )
}

const views: { value: View; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
]

function ViewSwitch({ view }: { view: View }) {
  return (
    <nav
      aria-label="View"
      className="flex items-center rounded-lg bg-muted p-[3px]"
    >
      {views.map(({ value, label }) => (
        <Link
          key={value}
          to="/"
          search={{ view: value }}
          aria-current={value === view ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            value === view && "bg-background text-foreground shadow-sm"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
