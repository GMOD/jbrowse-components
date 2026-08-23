---
name: the-config-read-baselines-remaining-129-is-mostly-not-display-debt
description: 75 of them are track/assembly reads; confirm that before estimating any of it
metadata:
  area: config, types
  category: ready
---

# The config-read baseline's remaining 129 is mostly not display debt

`scripts/configReadTypeGaps.txt:35` sits at 129 unchecked source reads — 147 more
in tests, of 911 config accessor calls in all — down from 154 once every
cross-cutting mixin named its own field table, then ratcheted to 125
(`a39ec369c0`) and re-banked at 129 by `d38e201db0`, whose message enumerates the
five new gaps and the one that left. The number invites a sweep and the sweep
would mostly be the wrong work, so the split is worth having before anyone
estimates it:

- **75 are track- or assembly-schema reads** — `name` 25, `assemblyNames` 22,
  `adapter` 14, `trackId` 14. They are filed under whichever display or widget
  file contains them, so the list reads as display debt and isn't: naming a
  display factory's schema cannot reach a read against the containing track.
- **~12 are the root config** — `theme` x5, `defaultDriver` x3, `extraThemes`
  x2, `workerCount`, `shareURL`. Blocked rather than small: the root schema is
  assembled from the plugin manager at runtime, and a base taken from
  `pluginManager.getDisplayType(…).configSchema` poisons the whole schema
  through `GetBase`, so it wants re-plumbing before naming it buys anything.
- The rest is a long tail of factories that left `configSchema` at
  `AnyConfigurationSchemaType`, usually one line each.

Grepping the baseline for `*Mixin.ts` returns four entries, and none of them is
the population the header closed — a display mixin casting its own `self` to a
widened config holder. `WiggleCommonMixin`'s is
`getConf(getContainingTrack(self), 'adapter')` and `AssembliesMixin`'s is
`readConfObject(a, 'name')` off an assembly, so both are track/assembly reads;
`EmbeddedSessionThemeMixin`'s two `getConf(self, 'theme')` reads are root-config
ones, blocked behind the same re-plumbing as the other ~12.

The mixin population is closed and should stay closed: `HostChecksSlotNames`
pins each host and the baseline's own header now says so — it used to say the
opposite ("load-bearing and ACCEPTED"), which is the sentence that had kept it
open. **Re-baseline in the same commit as any improvement**; the gate only fails
when the count grows, so a win nobody ratchets is a win that can be undone
silently.
