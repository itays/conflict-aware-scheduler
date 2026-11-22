import { CalendarPlusIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { SessionEditing } from "./scheduler-page"

export function EmptySchedule({
  onAddSession,
}: Pick<SessionEditing, "onAddSession">) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarPlusIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Nothing scheduled</EmptyTitle>
        <EmptyDescription>
          Add a session to start planning the day.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={(event) => onAddSession(event.currentTarget)}>
          <PlusIcon aria-hidden />
          Add the first session
        </Button>
      </EmptyContent>
    </Empty>
  )
}
