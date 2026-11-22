import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useReducer,
} from "react"
import { sampleDay } from "@/schedule/sample-day"
import {
  type Schedule,
  type ScheduleAction,
  scheduleReducer,
} from "@/schedule/schedule"

type ScheduleContextValue = {
  schedule: Schedule
  dispatch: Dispatch<ScheduleAction>
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null)

export function ScheduleProvider({
  children,
  initialSchedule,
}: {
  children: ReactNode
  initialSchedule?: Schedule
}) {
  const [schedule, dispatch] = useReducer(
    scheduleReducer,
    initialSchedule,
    (initial) => initial ?? sampleDay()
  )
  return (
    <ScheduleContext.Provider value={{ schedule, dispatch }}>
      {children}
    </ScheduleContext.Provider>
  )
}

export function useSchedule(): ScheduleContextValue {
  const value = useContext(ScheduleContext)
  if (!value)
    throw new Error("useSchedule must be used inside ScheduleProvider")
  return value
}
