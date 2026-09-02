---
name: per-row-styling-has-no-config-tier
description: A multi-wiggle subtrack's `color` works because two object spreads line up over a frozen slot — no schema declares it, so no validator, cascade, jexl or Copy-config sees it. The same `Source` shape is writable in one other place, `layout`, which is display *state* and so cannot be authored in a config or copied back out of one. One slot closes both gaps; why displayDefaults structurally cannot, and why the adapter tier has to stay.
---

# Per-row styling has no config tier

From a 2026-09-02 question about why `MultiWiggleAdapter` — an adapter — gets to
say what color a subtrack is, and why that felt like the easy option next to
`displayDefaults`.

The premise checks out in both directions: the colocation *is* the right
instinct, and the reason it feels like the only option is a missing slot rather
than a missing concept.

## What the mechanism actually is

The colors are not config. They are unmodeled passengers on a `frozen` slot.

`MultiWiggleAdapter` declares exactly two slots, both `frozen` —
`subadapters` and `bigWigs`
(`plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts:61`). `BigWigAdapter`
declares `source` and **not** `color`, `group`, `name` or `label`
(`plugins/wiggle/src/BigWigAdapter/configSchema.ts:52`). So a
`color: '#e6194b'` written inside a subadapter entry is a key no schema in the
tree knows exists. It survives because two spreads happen to line up:

- `getAdaptersImpl` returns `{...conf, dataAdapter, source}`
- `getSources` returns `{...rest, name: rest.source}`, having dropped `type`,
  `bigWigLocation` and `dataAdapter`
  (`plugins/wiggle/src/MultiWiggleAdapter/MultiWiggleAdapter.ts:296`)

From there it travels the **data** channel: into each region's RPC payload as
`SourceInfo` (`packages/wiggle-core/src/dataTypes.ts:1`), back out through
`sourcesFromRegionData`'s union
(`plugins/wiggle/src/MultiLinearWiggleDisplay/sourcesLogic.ts:21`), then merged
with the user's edits by `reconcileLayout(sourcesWithoutLayout, self.layout)`
(`plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts:180`).

Two consequences, and they are the same fact seen from each side. It is cheap to
author *because* it is unmodeled — no display type to name, no slot to look up,
one obvious key next to the file it applies to. And everything the config system
does is unavailable to it: no manifest entry, so `jbrowse validate` cannot spell-
check the key; no jexl; no promotable cascade or `resolveConf`; and no
appearance in the About dialog's "Copy config".

## It is the base ABI, not a wiggle quirk

`BaseFeatureDataAdapter.getSources()` declares
`{name: string; color?: string; [key: string]: unknown}[]` as its return type
(`packages/core/src/data_adapters/BaseAdapter/BaseFeatureDataAdapter.ts:245`).
MAF puts `{id, label, color}` on its adapter's `samples` slot; VCF puts the same
job behind `samplesTsvLocation`, a per-sample metadata TSV. Three plugins
arrived there independently, which is evidence the colocation is right rather
than a mistake to be undone.

## Why `displayDefaults` structurally cannot take this over

`displayDefaults` routes **by slot name**: `collectDisplayOverrides` sends each
key to every display type whose schema declares that slot
(`packages/core/src/pluggableElementTypes/models/expandTrackConfigShorthand.ts`).
A per-row color is not a slot and cannot become one — rows do not exist until
the adapter enumerates them, and for a dynamically discovered source set (a
VCF's samples, a fallback adapter finding sources per region) the track config
cannot name them at authoring time at all. **So the adapter tier stays.** Any
proposal here that begins by deleting it is answering a different question.

The separate reason `displayDefaults` is unpleasant is orthogonal and fixable:
its legal key set is the union of slots across all the track's display types,
nothing in the app discovers that set for you, an unrecognized key gets a
`console.warn` nobody reads, and no UI surface ever writes one — so it is
learned from docs or not at all. That is a discoverability problem, and the slot
below is also the first thing that would put a `displayDefaults` example in
front of a user without their having to go looking.

## The actual defect: one shape, two homes, no path between them

The same `Source` shape — `name` / `label` / `color` / `labelColor` / `group` —
is writable in exactly two places:

| | where | who writes it | survives as |
| --- | --- | --- | --- |
| adapter `color` | `subadapters[]`, a `frozen` slot | config author | config.json |
| `layout` | `TreeSidebarMixin.ts:51`, a **state** prop | Set Color dialog, clustering | session only |

`reconcileLayout` already merges them with the right precedence, and
`packages/tree-sidebar/src/types.ts` already states the row contract both sides
satisfy. But `layout` is `types.frozen<S[]>` on the state model rather than a
config slot, so:

- a config.json author cannot write row order, group or color on the display
  side at all — the adapter is the only door, which is exactly the observation
  this file starts from;
- a user who hand-colors forty rows cannot get that back into a config. The
  About dialog resolves promotable slots specifically so pasted output renders
  like the track it came from
  (`packages/product-core/src/ui/AboutDialogContents.tsx:40`) — and then omits
  the colors, because they are not in the track config.

## The proposal

**Give the four `TreeSidebarMixin` displays a `layout` config slot of the same
`Source[]` type, seeding the state prop when a session has not set one.** Four
things fall out of the one change:

- config authors get a schema'd, display-side home for per-row color, group,
  label and order — in the manifest, checked by `jbrowse validate`, reachable
  as `displayDefaults: { layout: [...] }`;
- "Copy config" can emit what the user picked, because the Set Color dialog
  already writes exactly that shape;
- the adapter form keeps working unchanged as the data-supplied default, which
  it must for dynamically discovered rows;
- precedence needs no new decision — `reconcileLayout` is already the merge, and
  its membership rules are already swept in `clusterUtils.test.ts`.

### What it costs

`layout`'s empty array is currently doing double duty as "unset", so it needs
the [ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md)
treatment — `undefined` as the sentinel — plus a resolved `effectiveLayout`
getter, since a bare getter here must return a value and not the sentinel.

It also interacts with clustering, which writes `layout`. A clustering run
beating a config-authored layout is correct (a user action beats a config
default), but "reset" then has to mean *back to the config value* rather than
*back to empty*, which is a third state the current `setLayout([])` callers do
not have. That is the part to design before writing code, and it is the same
question [promotable-slot-escape-hatches.md](promotable-slot-escape-hatches.md)
§1 asks about getting back out of a value you set — worth answering once for
both.

### Three things it must not do

- **Do not extend `displayDefaults` to express per-row anything.** Key routing
  is by slot name; rows are not slots. `layout` as a single slot is compatible
  with the existing routing and needs nothing new from it.
- **Do not remove the adapter `color`.** It is the only form that works for an
  adapter snapshot handed over by a hub or the add-track workflow, and the only
  one available where the row set is discovered rather than declared.
- **Do not try to give `subadapters` a real schema.** Its interior is the whole
  adapter union, and the same opacity already defeats the relative-URI walker —
  [config-and-sessions.md](config-and-sessions.md) has that analysis and its
  conclusion that frozen interiors stay opaque under any fix.
