---
status: Accepted
summary: "Setting a display-type default writes only the session-wide value; rewriting tracks is a separate, explicitly-labeled, opt-in action"
---

# ADR-048: The pin edits the stylesheet, never the elements

## Status

Accepted (2026-07). Mechanism:
[DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md) §"UI surface".

## Context

The make-default pin sets a session-wide default for a display type. The
question this ADR settles is what *else* that click is allowed to touch.

The pull toward doing more is real: a user who pins "compact" on a track that
holds its own `displayMode` sees nothing happen to the track in front of them,
because a customized track outranks the default. That reads as a broken control.

## Decision

**`setDisplayTypeDefault` is the entire write.** No track's own value is ever
touched by pinning. Tracks that follow the default pick the new value up on
their next `resolveConf` read; customized tracks keep theirs.

Rewriting tracks happens only through the snackbar's **"Override N customized
tracks"** action — one explicit, separately-labeled gesture.

### Rejected: toggling on also resets the clicking display to inherit

This was the behavior, and it made the user's own track update with one click.
It also silently discarded that display's value: pin-then-unpin left the track at
`promotedBase` rather than at what it held before. A **two-click, non-undoable
loss of data from a control that reads as a toggle** — the worst shape a
destructive action can take, because toggles are how users explore.

Keeping the pin symmetric costs one extra click on a customized track and
removes the whole failure mode. That track is now simply counted in "Override N
customized tracks" like any other.

### The action is named for what it does

It was "Apply to N open tracks", which reads as additive. The default is already
set by the time the snackbar appears, so a track that still differs is one
holding its *own* value — the action **clears that value**. It is a bulk,
non-undoable discard of exactly those customizations, and the label has to say
so.

### The action re-derives on click

The snackbar outlives the click that raised it, so the target set is recomputed
in `onClick`, not captured:

- A track closed in between would otherwise be reset as a dead MST node; one
  newly opened would be silently skipped.
- The default itself can be gone (the user unpinned, or pinned a sibling value on
  the same slot). The action only ever means "make these tracks follow the
  default I just set", so with that default no longer in place it does nothing —
  clearing their own values would strand them on whatever replaced it, discarding
  customizations to reach a value nobody asked for.

## Consequences

- The pin is safe to click and safe to un-click. That is what makes it
  discoverable enough to show on every value row.
- The mental model is CSS: the pin edits the stylesheet, the value control edits
  the element. Every question about what a control should touch resolves against
  that analogy.
- No radio or checkbox group offers a "follow default" row — picking a value
  customizes, leaving the group untouched follows the default. The three slider
  rows are the exception (a slider has no untouched position), and reset there
  writes `undefined`.
- A user who wants a customized track back on the cascade uses the snackbar
  action or the track-selector badge's "Reset to default".
