# The schedule is one day

The app plans a single day. Every session starts on that day and may run past midnight, up to a 24-hour duration, but nothing starts on the next day. This meets the brief's "sessions crossing midnight" case without building multi-day storage, navigation, or cross-day conflict checks, which do not fit the 4-hour build. The cost: a session that began the previous evening cannot be represented, and moving to multiple days later means changing how a session's start is stored.
