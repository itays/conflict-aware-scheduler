import { Link } from "@tanstack/react-router"
import { FilterIcon } from "lucide-react"
import type { Ref } from "react"
import type { Conflict } from "@/schedule/schedule"
import { formatTimeRange } from "@/schedule/time"
import type { View } from "./scheduler-page"

/**
 * Says which conflicts a view is focused on, or that they have been
 * resolved, with a link back to the whole view.
 */
export function ConflictFocusBar({
  view,
  conflicts,
  verb,
  clearLabel,
  clearRef,
}: {
  view: View
  conflicts: Conflict[]
  /** What the view does with the focused conflicts: "Showing". */
  verb: string
  clearLabel: string
  clearRef?: Ref<HTMLAnchorElement>
}) {
  const message =
    conflicts.length === 0
      ? "This conflict is resolved."
      : `${verb} ${conflicts
          .map((c) => `the conflict at ${formatTimeRange(c.start, c.end)}`)
          .join(" and ")}.`
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <FilterIcon aria-hidden className="size-4 text-muted-foreground" />
      <p className="flex-1">{message}</p>
      <Link
        ref={clearRef}
        to="/"
        search={{ view }}
        className="rounded-md px-2 py-0.5 font-medium underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {clearLabel}
      </Link>
    </div>
  )
}
