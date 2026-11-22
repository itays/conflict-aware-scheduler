import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CalendarDaysIcon } from "lucide-react"
import { z } from "zod"
import { AgendaView } from "./agenda-view"
import { ConflictSummary } from "./conflict-summary"
import { DayView } from "./day-view"
import { ModeToggle } from "./mode-toggle"

export const viewSearchSchema = z.object({
  view: z.enum(["day", "agenda"]).default("day").catch("day"),
})

export type View = z.infer<typeof viewSearchSchema>["view"]

export function SchedulerPage({ view }: { view: View }) {
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
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {view === "agenda" ? <AgendaView /> : <DayView />}
      </main>
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
