import { useSyncExternalStore } from "react"

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" })
const fullDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
})

export function TodayHeader() {
  const today = useToday()
  return <div className="h-14 shrink-0">{today && <DayDate day={today} />}</div>
}

function DayDate({ day }: { day: string }) {
  const date = new Date(`${day}T00:00`)
  return (
    <time dateTime={day} className="flex items-center gap-3">
      <span aria-hidden className="flex flex-col items-center">
        <span className="text-xs font-semibold text-primary uppercase">
          {weekdayFormat.format(date)}
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground tabular-nums">
          {date.getDate()}
        </span>
      </span>
      <span className="font-semibold">{fullDateFormat.format(date)}</span>
    </time>
  )
}

function localDateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function subscribeToMidnight(onMidnight: () => void) {
  let timer: ReturnType<typeof setTimeout>
  const arm = () => {
    const now = new Date()
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    )
    timer = setTimeout(() => {
      onMidnight()
      arm()
    }, midnight.getTime() - now.getTime())
  }
  arm()
  return () => clearTimeout(timer)
}

/**
 * Today as the viewer's local "YYYY-MM-DD", rolling over at their midnight.
 * Null on the server and during hydration: the server's clock is in UTC, so
 * its "today" can be another day than the viewer's.
 */
function useToday() {
  return useSyncExternalStore(
    subscribeToMidnight,
    () => localDateKey(new Date()),
    () => null
  )
}
