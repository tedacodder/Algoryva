# Clubs (v1)

**Status: built and tested** (integration tests on real PostgreSQL, bot tests). Nothing is deployed.

## Rules

- Any linked student can create a club (`/club create <name>`) or join one with its code (`/club join <code>`).
- One club per student. Joining or creating a second one is refused with a message.
- A club's weekly score is the sum of its members' **verified** points for the current week, using the same scoring and daily cap as the public board. Self-reported and legacy solves score nothing.
- The club board (`/club top`) shows club names, member counts and scores. **It never shows member names.**
- The leader cannot leave while other members remain. Leadership transfer is **not built**. The message says so.
- Deleting the leader's account deletes the club and its memberships. This is tested.

## What is not built

- Leadership transfer and club moderation.
- Group-based club announcements.
- Club-versus-club contests.

These need your decisions on who may moderate and what a club may publish.
