---
status: Accepted
summary: "The pin's click applies the value to every open track of the display type; promoting it to a session-wide default is the snackbar's one opt-in action"
---

# ADR-048: The pin applies, then offers the default

## Status

Accepted (2026-07), **reversed 2026-08-29** — the click and the snackbar action
have swapped places. The superseded decision is kept below under
[The stylesheet reading, and why it went](#the-stylesheet-reading-and-why-it-went),
because its failure mode is real and the new shape has to answer for it.
Mechanism: [DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md)
§"UI surface".

**Amended 2026-09-02** for checkbox rows: their pin is the row's own checkbox
over every open track of the type (`makeTogglePin`). Its fill mirrors the row, a
click flips the state on every open track and offers the new state as the
default, and it never clears a default — flipping back and taking the offer
promotes the other value. The "filled means promoted, click to clear" reading
below now holds only for the value pins on radio and size rows. What prompted
it: the symmetric pin carried the row's current state, so beside an unchecked
"Show legend" it applied *off* everywhere and visibly did nothing.

## Context

The make-default pin sits on every promotable menu row. The question this ADR
settles is what the click does, and what the snackbar it raises offers.

Two effects are available, and they are not the same size:

- **Apply to the open tracks.** Bounded, visible, and about the tracks in front
  of the user.
- **Promote to a display-type default.** Unbounded in time: it outlives the
  tracks it was set for and governs every track of that type opened later.

## Decision

**The click applies. The snackbar promotes.**

`toggle` on a pin whose value is not the current default writes that value into
every open track of the display type — `applySlotToOpenTracks` over
`openTracksOfType` — and raises `"Applied to N open tracks"` carrying one
action, **"Set as the default"**, which stores the display-type default and
touches nothing else.

`toggle` on a pin that *is* the current default clears that default and writes
no track. `"Cleared the default"`, no action.

So a default takes two deliberate clicks, and the pin's filled state means the
default is in place — **the state the pin draws is not the effect of clicking
it**, which is the one genuinely awkward thing here and the reason
`PinAdornment` words the two states separately (`apply Compact to all open
tracks` vs `clear the default for Compact`).

### One apply, not an override/apply pair

The snackbar used to carry two actions over two different track sets: "Override
N customized tracks" (clear the own values of tracks that *resolve* to something
else) and "Apply to N open tracks instead" (write the value into every open
track, reading the *stored* value). The distinction is real in the code and
invisible to the user, who has one intention — "make these look like this" — and
no reason to know that a follower and a customized track need opposite writes to
get there.

`applySlotToOpenTracks` covers both, because overwriting a customized track is
the same write as filling in a follower. It reads the **stored** value, which is
what makes it total: a follower holds nothing of its own and is showing the value
only by way of whatever default is in place, so skipping it would leave it free
to move again the next time that default changed. Reading the stored value is
also what lets a `jexl:` slot answer "is this already what we would write?"
without being evaluated — this caller has no feature context.

### Promoting does not then clear what it applied

"Set as the default" writes the session default and stops. The open tracks keep
the values the click just wrote, so they are customized and a later default
change will not reach them.

That is deliberate. Clearing them would be a *second* bulk write, and it would
make the subsequent "clear the default" click visibly revert every open track to
`promotedBase` — turning the only remaining toggle in the flow into a bulk
discard. It also costs nothing in practice: the pin overwrites open tracks on
every click, so the redundant copies are corrected by the next pin the user
touches.

### The action closes over the display type, and nothing else

The snackbar outlives the click that raised it, so "Set as the default" must not
close over a *decision* — not the track set, not whether to apply or promote,
both of which are answers to "what is open now" and go stale the moment the
snackbar is left up.

What it does close over is the display TYPE, a plain string read when the
snackbar is raised. That is not a decision: a promoted default is keyed by
display type and exists to govern tracks opened *later*, so it has nothing to
say about whether the clicked display is still open. The action originally
guarded `isAlive(self)` and reached back through `self.type`, on the reasoning
that a destroyed display throws on any read — true of the read, but the
conclusion was to skip the write, so a user who applied a value, closed the
track, and then took the offer got a silent no-op of an explicit action. Holding
the string removes the read, and the guard moves to `isAlive(session)`, which is
what actually owns the map the write lands in.

Canary: `promotableDefaults.test.ts`, `'"Set as the default" still promotes once
the clicked track is gone'`.

### The clicked track is always written

`openTracksOfType` seeds its map with `self` before walking the session, so the
track the pin was clicked from is in the applied set by construction rather than
by the walk happening to reach it. Under the old decision a display the walk
missed cost nothing — the click wrote only the session default. Now it would be
the whole of the click.

## The stylesheet reading, and why it went

The superseded decision was: **`setDisplayTypeDefault` is the entire write**, no
track's own value ever touched by the pin. The mental model was CSS — the pin
edits the stylesheet, the value control edits the element — and its payoff was
**symmetry**: pin-then-unpin discarded nothing, which is what made a pin safe
enough to show on every value row.

It was reversed on the judgment that the two effects are the wrong way round for
what users actually click a pin to do, and that the override/apply pair was a
distinction with no user-facing meaning.

**What that gives up, stated plainly:** the pin is no longer symmetric. The first
click is a bulk write over every open track of the type, and no later click
un-applies it — the second click can only clear the default. A user exploring by
toggling loses the per-track values those tracks held.

**What is left in its place:** the write is at least *visible* — the tracks in
front of the user change, and the snackbar names how many — where the old
silent-on-a-customized-track click was the complaint that started this. The
older rejected behavior, "toggling on also resets the clicking display to
inherit", stays rejected for its own reason: it discarded a value *and* left no
trace, so pin-then-unpin stranded the track on `promotedBase` rather than on
either value it had held.

## Consequences

- The pin's click is a bulk edit. It is not safe to click idly, and the copy has
  to say what it does rather than what state it shows.
- A promoted default is now a two-click, deliberate act, which suits how long it
  lives.
- The snackbar is still the only place in the subsystem that writes the session
  default, and the pin is now the only place that writes a track.
- No radio or checkbox group offers a "follow default" row — picking a value
  customizes, leaving the group untouched follows the default. The three slider
  rows are the exception (a slider has no untouched position), and reset there
  writes `undefined`. That reset is now the *only* path that unsets a promotable
  slot, and it carries the `trackConfigDeltas` removal hazard on its own
  (`PromotedDefaultApply.test.ts`).
- A user who wants a customized track back on the cascade uses the slider reset
  or the track-selector badge's "Reset to default".
