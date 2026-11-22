import { createFileRoute, Link } from "@tanstack/react-router"
import { CalendarDaysIcon } from "lucide-react"
import { z } from "zod"
import { AgendaView } from "@/components/agenda-view"
import { ConflictSummary } from "@/components/conflict-summary"
import { ModeToggle } from "@/components/mode-toggle"
import { ScheduleProvider } from "@/components/schedule-provider"

const searchSchema = z.object({
  view: z.enum(["day", "agenda"]).default("day").catch("day"),
})

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Home,
})

function Home() {
  const { view } = Route.useSearch()

  return (
    <ScheduleProvider>
      <div className="flex min-h-svh flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
          <h1 className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDaysIcon aria-hidden className="size-4" />
            </span>
            Scheduler
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <ConflictSummary />
            <ModeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {view === "agenda" ? <AgendaView /> : <DayViewPlaceholder />}
        </main>
      </div>
    </ScheduleProvider>
  )
}

function DayViewPlaceholder() {
  return (
    <p className="text-sm text-muted-foreground">
      The Day view is on its way.{" "}
      <Link
        to="/"
        search={{ view: "agenda" }}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Open the Agenda
      </Link>
    </p>
  )
}
