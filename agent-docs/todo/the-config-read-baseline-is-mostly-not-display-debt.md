---
name: the-config-read-baseline-is-mostly-not-display-debt
description: 81 of the 135 are track/assembly reads; confirm the split against the baseline before estimating any of it
metadata:
  area: config, types
  category: ready
---

# The config-read baseline is mostly not display debt

`scripts/configReadTypeGaps.txt:35` sits at 135 unchecked source reads — 155 more
in tests, of 949 config accessor calls in all — down from 154 once every
cross-cutting mixin named its own field table, then ratcheted to 125
(`a39ec369c0`), re-banked at 129 by `d38e201db0` and at 135 by `53abe1922c`. The
number invites a sweep and the sweep would mostly be the wrong work, so the split
is worth having before anyone estimates it. **Recount it from the baseline rather
than from this page** — every figure here moves with the next re-bank, and the
last two moved together:

- **81 are track- or assembly-schema reads** — `name` 25, `assemblyNames` 24,
  `trackId` 16, `adapter` 16. They are filed under whichever display or widget
  file contains them, so the list reads as display debt and isn't: naming a
  display factory's schema cannot reach a read against the containing track.
  This is also the whole of the growth. The six that took 129 to 135 are the
  synteny and MAF launch helpers, `MultiWaySyntenyDisplay` and `SessionTracks`
  reading off a session track config they were handed, which no concrete schema
  at the call site can narrow — so the population grew and the thesis held.
- **10 are the root config** — `theme` ×5, `extraThemes` ×2, `defaultDriver`,
  `workerCount`, `shareURL`. Blocked rather than small: the root schema is
  assembled from the plugin manager at runtime, and a base taken from
  `pluginManager.getDisplayType(…).configSchema` poisons the whole schema
  through `GetBase`, so it wants re-plumbing before naming it buys anything.
- The rest is a long tail of factories that left `configSchema` at
  `AnyConfigurationSchemaType`, usually one line each.

Grepping the baseline for `*Mixin.ts` returns four reads across three files, and
none of them is the population the header closed — a display mixin casting its
own `self` to a widened config holder. `WiggleCommonMixin`'s is
`getConf(getContainingTrack(self), 'adapter')` and `AssembliesMixin`'s is
`readConfObject(a, 'name')` off an assembly, so both are track/assembly reads;
`EmbeddedSessionThemeMixin`'s two `getConf(self, 'theme')` reads are root-config
ones, blocked behind the same re-plumbing as the other 10.

The mixin population is closed and should stay closed: `HostChecksSlotNames`
pins each host and the baseline's own header now says so — it used to say the
opposite ("load-bearing and ACCEPTED"), which is the sentence that had kept it
open. **Re-baseline in the same commit as any improvement**; the gate only fails
when the count grows, so a win nobody ratchets is a win that can be undone
silently.
