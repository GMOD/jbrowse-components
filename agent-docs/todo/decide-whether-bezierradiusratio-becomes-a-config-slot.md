---
name: decide-whether-bezierradiusratio-becomes-a-config-slot
description: decide whether the state-model property stays beside the slot
metadata:
  area: circular view, config
  category: ready
---

# Decide whether `bezierRadiusRatio` becomes a config slot

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
