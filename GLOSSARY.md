# Conflict-Aware Scheduler

A single-page app for planning one day of sessions and spotting where they collide.

## Language

**Schedule**:
The set of sessions planned for one day. Every session in it starts on that day.
_Avoid_: Calendar, day plan

**Session**:
A titled block of time with a start and a duration, covering every minute from its start up to, but not including, its end.
_Avoid_: Event, booking, appointment, meeting

**Duration**:
How long a session lasts, from 5 minutes to 24 hours in 5-minute steps. A session may end after midnight.
_Avoid_: Length

**Back-to-back**:
Two sessions where one ends at the exact minute the other starts. They share no minute, so they do not overlap.
_Avoid_: Adjacent, touching

**Overlap**:
Two sessions that share at least one minute.
_Avoid_: Clash, collision, double-booking

**Free slot**:
A stretch of the schedule's day with no session in it. A session fits a free slot when its duration is no longer than the slot.
_Avoid_: Gap, opening, availability

**Conflict**:
The largest set of sessions linked to each other by overlaps, directly or through other sessions. Sessions at 09:00–10:00, 09:30–10:30 and 10:15–11:00 form one conflict made of two overlaps.
_Avoid_: Using "conflict" for a single pair
