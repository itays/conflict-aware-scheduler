import { createFileRoute } from "@tanstack/react-router"
import { ScheduleProvider } from "@/components/schedule-provider"
import { SchedulerPage, viewSearchSchema } from "@/components/scheduler-page"

export const Route = createFileRoute("/")({
  validateSearch: viewSearchSchema,
  component: Home,
})

function Home() {
  const { view, conflict } = Route.useSearch()

  return (
    <ScheduleProvider>
      <SchedulerPage view={view} conflict={conflict} />
    </ScheduleProvider>
  )
}
