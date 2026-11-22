import { cn } from "cn"
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"
import { type FormEvent, type RefObject, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  MINUTES_PER_DAY,
  overlapsWith,
  type Session,
  sessionEnd,
} from "@/schedule/schedule"
import {
  draftTiming,
  type SessionDraft,
  validateSessionDraft,
} from "@/schedule/session-draft"
import { formatTime, formatTimeRange } from "@/schedule/time"
import { useSchedule } from "./schedule-provider"

const DURATION_PRESETS = [15, 30, 45, 60, 90]
const NEW_SESSION_DRAFT: SessionDraft = {
  title: "",
  start: "09:00",
  duration: "30",
}

function draftFrom(session: Session | undefined): SessionDraft {
  if (!session) return NEW_SESSION_DRAFT
  return {
    title: session.title,
    start: formatTime(session.start),
    duration: String(session.duration),
  }
}

/**
 * The one dialog for adding, editing and deleting a session. `session` set
 * means edit; unset means new. Mount a fresh instance per opening so the
 * form starts from `session`.
 */
export function SessionDialog({
  open,
  session,
  onClose,
  returnFocusTo,
}: {
  open: boolean
  session?: Session
  onClose: () => void
  /** Where focus goes on close, looked up then since the opener may be gone. */
  returnFocusTo: () => HTMLElement | null
}) {
  const titleInput = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent initialFocus={titleInput} finalFocus={returnFocusTo}>
        <DialogHeader>
          <DialogTitle>{session ? "Edit session" : "New session"}</DialogTitle>
        </DialogHeader>
        <SessionForm
          session={session}
          titleInput={titleInput}
          onDone={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

function SessionForm({
  session,
  titleInput,
  onDone,
}: {
  session?: Session
  titleInput: RefObject<HTMLInputElement | null>
  onDone: () => void
}) {
  const { schedule, dispatch } = useSchedule()
  const [draft, setDraft] = useState(() => draftFrom(session))
  const [customDuration, setCustomDuration] = useState(
    () => !DURATION_PRESETS.includes(Number(draft.duration))
  )
  const [touched, setTouched] = useState<Set<keyof SessionDraft>>(
    () => new Set()
  )
  const ids = { title: useId(), start: useId(), duration: useId() }

  const result = validateSessionDraft(draft)
  const errorFor = (field: keyof SessionDraft) =>
    !result.ok && touched.has(field) ? result.errors[field] : undefined
  const timing = draftTiming(draft)

  const edit = (field: keyof SessionDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setTouched((current) => new Set(current).add(field))
  }
  const touch = (field: keyof SessionDraft) =>
    setTouched((current) => new Set(current).add(field))

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!result.ok) return
    if (session) {
      dispatch({ type: "update", session: { ...session, ...result.value } })
    } else {
      dispatch({
        type: "add",
        session: { id: crypto.randomUUID(), ...result.value },
      })
    }
    onDone()
  }

  const textField = (
    field: keyof SessionDraft,
    label: string,
    props: React.ComponentProps<typeof Input>
  ) => {
    const error = errorFor(field)
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={ids[field]}>{label}</FieldLabel>
        <Input
          id={ids[field]}
          value={draft[field]}
          onChange={(event) => edit(field, event.target.value)}
          onBlur={() => touch(field)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids[field]}-error` : undefined}
          {...props}
        />
        <FieldError id={`${ids[field]}-error`}>{error}</FieldError>
      </Field>
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        {textField("title", "Title", {
          ref: titleInput,
          autoComplete: "off",
        })}
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-[8rem_1fr]">
          {textField("start", "Start", {
            inputMode: "numeric",
            placeholder: "HH:mm",
            autoComplete: "off",
            className: "tabular-nums",
          })}
          <Field>
            <span className="text-sm leading-snug font-medium">Ends</span>
            <EndTime timing={timing} />
          </Field>
        </div>
        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="mb-0">
            Duration
          </FieldLegend>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((minutes) => (
              <DurationOption
                key={minutes}
                label={`${minutes} min`}
                checked={!customDuration && draft.duration === String(minutes)}
                onSelect={() => {
                  setCustomDuration(false)
                  edit("duration", String(minutes))
                }}
              />
            ))}
            <DurationOption
              label="Custom"
              checked={customDuration}
              onSelect={() => setCustomDuration(true)}
            />
          </div>
          {customDuration &&
            textField("duration", "Custom duration (minutes)", {
              inputMode: "numeric",
              autoComplete: "off",
              className: "w-32 tabular-nums",
            })}
        </FieldSet>
      </FieldGroup>

      <OverlapPreview
        overlaps={
          timing
            ? overlapsWith(schedule, {
                id: session?.id ?? "",
                title: draft.title,
                ...timing,
              })
            : undefined
        }
      />

      <DialogFooter className="items-center">
        {session && (
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            onClick={() => {
              dispatch({ type: "delete", id: session.id })
              onDone()
            }}
          >
            Delete
          </Button>
        )}
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={!result.ok}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

function EndTime({
  timing,
}: {
  timing: { start: number; duration: number } | undefined
}) {
  if (!timing) {
    return <p className="h-9 py-2 text-sm text-muted-foreground">—</p>
  }
  const end = timing.start + timing.duration
  return (
    <p aria-live="polite" className="h-9 py-2 text-sm tabular-nums">
      {formatTime(end)}
      {end > MINUTES_PER_DAY && (
        <span className="ml-1.5 text-chart-3">next day</span>
      )}
    </p>
  )
}

function DurationOption({
  label,
  checked,
  onSelect,
}: {
  label: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        "relative cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted"
      )}
    >
      <input
        type="radio"
        name="duration"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      {label}
    </label>
  )
}

function OverlapPreview({
  overlaps,
}: {
  overlaps: ReturnType<typeof overlapsWith> | undefined
}) {
  if (!overlaps) return null
  if (overlaps.length === 0) {
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <CircleCheckIcon aria-hidden className="size-4" />
        No overlaps
      </p>
    )
  }
  return (
    <section
      aria-labelledby="overlap-preview-heading"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <h3
        id="overlap-preview-heading"
        aria-live="polite"
        className="flex items-center gap-2 font-medium"
      >
        <TriangleAlertIcon aria-hidden className="size-4" />
        Overlaps {overlaps.length}{" "}
        {overlaps.length === 1 ? "session" : "sessions"}
      </h3>
      <ul
        aria-label="Overlapping sessions"
        className="mt-1.5 flex flex-col gap-1"
      >
        {overlaps.map(({ session, minutes }) => (
          <li key={session.id} className="flex justify-between gap-4">
            <span className="min-w-0 truncate">
              {session.title}{" "}
              <span className="tabular-nums opacity-85">
                {formatTimeRange(session.start, sessionEnd(session))}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{minutes} min</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        You can still save. The conflict will show on the schedule.
      </p>
    </section>
  )
}
