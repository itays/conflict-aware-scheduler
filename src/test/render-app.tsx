import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ScheduleProvider } from "@/components/schedule-provider"
import { SchedulerPage, viewSearchSchema } from "@/components/scheduler-page"
import { ThemeProvider } from "@/components/theme-provider"
import type { Schedule } from "@/schedule/schedule"

/** Renders the scheduler page at `url` behind an in-memory router. */
export async function renderApp(url = "/", initialSchedule?: Schedule) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    validateSearch: viewSearchSchema,
    component: function Index() {
      const { view, conflict } = indexRoute.useSearch()
      return (
        <ThemeProvider defaultTheme="light">
          <ScheduleProvider initialSchedule={initialSchedule}>
            <SchedulerPage view={view} conflict={conflict} />
          </ScheduleProvider>
        </ThemeProvider>
      )
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })

  const user = userEvent.setup()
  render(<RouterProvider router={router} />)
  await screen.findByRole("banner")
  return { router, user }
}
