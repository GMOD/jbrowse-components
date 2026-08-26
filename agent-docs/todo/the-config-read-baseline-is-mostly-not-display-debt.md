---
name: the-config-read-baseline-is-mostly-not-display-debt
description: most of the unchecked reads are against a track or assembly config, which no display narrowing reaches; read the split off the table before estimating any of it
metadata:
  area: config, types
  category: ready
---

# The config-read baseline is mostly not display debt

`scripts/configReadTypeGaps.txt` counts the config reads whose slot name and
value type are unchecked — down from 154 once every cross-cutting mixin named
its own field table, then ratcheted to 125 (`a39ec369c0`), re-banked at 129 by
`d38e201db0` and at 135 by `53abe1922c`. The count invites a sweep and the sweep
would mostly be the wrong work, so the split is worth having before anyone
estimates it. `--write` refreshes both the baseline and this table, so a re-bank
can no longer leave the figure citing it behind:

<!-- BEGIN GENERATED MEASUREMENT config-read-gap-populations -->

| population               | slot names                                                         | unchecked reads |
| ------------------------ | ------------------------------------------------------------------ | --------------: |
| track or assembly schema | `name`, `assemblyNames`, `trackId`, `adapter`                      |              81 |
| root config              | `theme`, `extraThemes`, `defaultDriver`, `workerCount`, `shareURL` |              10 |
| everything else          | 31 other names                                                     |              44 |

<!-- END GENERATED MEASUREMENT config-read-gap-populations -->

The grouping is by SLOT NAME, which is what the audit can see rather than what
the read is against — close enough that it is worth reading, not a proof. What
each row wants is different:

- **The track/assembly row is not display debt**, though the baseline makes it
  look like debt: reads are filed under whichever display or widget file
  contains them, and naming a display factory's schema cannot reach a read
  against the containing track. It is also the whole of the growth — the six
  that took 129 to 135 are the synteny and MAF launch helpers,
  `MultiWaySyntenyDisplay` and `SessionTracks` reading off a session track
  config they were handed, which no concrete schema at the call site can narrow.
  The population grew and the thesis held.
- **The root-config row is blocked rather than small.** That schema is assembled
  from the plugin manager at runtime, and a base taken from
  `pluginManager.getDisplayType(…).configSchema` poisons the whole schema
  through `GetBase`, so it wants re-plumbing before naming it buys anything.
- **The tail is one line each**, mostly factories that left `configSchema` at
  `AnyConfigurationSchemaType` — plus the `frozen`/`maybeFrozen` slots that are
  `any` by design and will never leave the list.

Grepping the baseline for `*Mixin.ts` returns four reads across three files, and
none of them is the population the header closed — a display mixin casting its
own `self` to a widened config holder. `WiggleCommonMixin`'s is
`getConf(getContainingTrack(self), 'adapter')` and `AssembliesMixin`'s is
`readConfObject(a, 'name')` off an assembly, so both are track/assembly reads;
`EmbeddedSessionThemeMixin`'s two `getConf(self, 'theme')` reads are root-config
ones, blocked behind the same re-plumbing as the rest of that row.

The mixin population is closed and should stay closed: `HostChecksSlotNames`
pins each host and the baseline's own header now says so — it used to say the
opposite ("load-bearing and ACCEPTED"), which is the sentence that had kept it
open, and [adr-052](../architecture-decision-records/adr-052-slot-name-safety-is-a-write-guard.md)
carries the correction beside the whole-surface table. **Re-baseline in the same
commit as any improvement**; the gate only fails when the count grows, so a win
nobody ratchets is a win that can be undone silently.
