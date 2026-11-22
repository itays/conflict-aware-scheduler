# Conflicts warn, they never block saving

Saving a session that overlaps another is always allowed. The app shows the conflict and helps resolve it, but only invalid input (empty title, a time that does not parse, a duration outside 5 minutes to 24 hours) stops a save. Real schedules double-book on purpose, such as a room hold during the meeting that needs it, and refusing the save would push users to work around the tool instead of seeing the problem.
