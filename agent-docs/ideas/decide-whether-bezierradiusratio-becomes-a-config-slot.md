---
name: decide-whether-bezierradiusratio-becomes-a-config-slot
description: `ChordVariantDisplay.bezierRadiusRatio` is an MST property nothing can set — no action, no menu item, no slot — and two authors documented it as config anyway. Adding the slot means deciding whether the property stays beside it, and whether it wants a menu entry too.
---

# Decide whether `bezierRadiusRatio` becomes a config slot

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Nothing in the release turns on how deep a chord bows,
and the entry is two decisions in front of a one-line addition.

`ChordVariantDisplay.bezierRadiusRatio` sets how deep a chord bows toward the
center of the circular view. It is an MST property of the display's state model
with a `0.1` default, and today nothing can set it: no action mutates it, no
track-menu item offers it, and a track config drops it because the display's
schema declares no such slot. Only a hand-edited session reaches it.

Two independent authors wrote it into an `#example` as though it were config —
both the `#config` and the `#stateModel` block carried the same wrong track
config until 2026-08-16, which is the evidence that the missing slot is the
surprise rather than the property.

What has to be decided, and why it isn't a one-line addition:

- **Whether the property stays.** Adding the slot beside it leaves two spellings
  of one setting, so the slot needs a `migratedDisplayKeys` entry the way
  `heightPreConfig` has one, or the property goes and every saved session
  carrying it silently loses the value.
- **Whether it wants a menu item too.** The comment in `validateConfig`'s
  `checkSessionDisplay` states the direction as "every track-menu setting is a
  config slot now"; this one is neither, so adding just the slot leaves it the
  only chord geometry with no UI.
