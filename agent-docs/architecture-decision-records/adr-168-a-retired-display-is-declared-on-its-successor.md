---
status: Accepted
summary: "A display type retired into another, and the display-instance props an old session carries that are config slots now, are declared on the successor's DisplayType — `retiredTypes` (each with a `migrate` for the settings its picture needs), `retiredConfig` (a legacy slot value on any entry) and `retiredState` (`keys` and a `lift` into config) — and one pass per surface reads them: the track config's preprocessor before any `Core-preProcessTrackConfig` handler, `JBrowseModel` over the frozen `tracks`, and the session migration over display instances, whose lifted settings land in the track's `sessionTracks` entry or `trackConfigDeltas`. `aliases` derives from `retiredTypes`. This replaces `addDisplayConfigMigration`, `foldRetiredMatrixDisplay`, product-core's `displayTypeMap` and `migrateConfigSnapshot`, and reverses the \"no migration\" consequence of ADR-143 and ADR-157 for share-link state: a v4 multi-wiggle, a clustered multi-sample VCF and a jb2hubs overlaid multiWig load as they drew"
---

# ADR-168: A retired display is declared on its successor

## Status

Accepted (2026-09-25). Reverses the "no migration" consequence of
[ADR-143](adr-143-one-quantitative-display-and-facet-is-the-layout.md) and
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md) for
sessions, share links and the multi-wiggle config spelling, under the rule
[ADR-070](adr-070-viewport-is-a-stored-window.md) records for `bpPerPx`: v5
breaks configs and plugin APIs freely, but not state in URLs other people hold.
`refuseRetiredState` and `checkRowsField` still refuse what reaches a model or
a schema some other way.

## Context

ADR-143 deleted `MultiLinearWiggleDisplay` and ADR-157 moved the row displays'
arrangement from display state into `rows`, both with no migration. Loading v4
sessions through `setSession` showed what that cost:

- A session naming `MultiLinearWiggleDisplay`, which every v4.3.0 multi-bigwig
  track wrote, held the track back with "pending plugins this JBrowse does not
  have: MultiLinearWiggleDisplay", a plugin that does not exist.
- A v4 multi-sample variant display carrying `layout` — written by any
  clustering run or reorder, and by v4.3.0's colorBy autorun on load — threw in
  the model's `preProcessSnapshot`, and the recipient got the default session.
- jb2hubs keeps writing `MultiLinearWiggleDisplay` with `multixyplot` for older
  releases, and v5 dropped that entry with a warning, so a UCSC overlaid
  multiWig opened as stacked rows.

The one migration that did carry settings, v4 alignments, wrote them into
`trackConfigDeltas` under the old type's id (`bam-LinearPileupDisplay`). A
config.json track hydrates `bam-LinearAlignmentsDisplay`, so the first-wins
dedupe dropped the delta's entry and the display opened at its defaults. Its
test asserted the old id, and nothing loaded a migrated session as far as a
display.

That was five mechanisms: `aliases` for the type, `addDisplayConfigMigration`
for a slot value, product-core's `displayTypeMap` for a type's settings, a
model `preProcessSnapshot` renaming an instance, and a plugin's own
`Core-preProcessTrackConfig` fold (`foldRetiredMatrixDisplay`). Two of them
listed the same retired names, and the central table was one a plugin out of
tree could not add to.

## Decision

**A DisplayType declares what it replaced.**

| member          | holds                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| `retiredTypes`  | `{ type, migrate? }` per display type retired into this one; `migrate` rewrites its entry |
| `retiredConfig` | rewrites any entry of this display whose slot value an older release spelt differently |
| `retiredState`  | `{ keys, lift }`: the instance props an old session carries, and the slots they become  |

`aliases` is `retiredTypes`' names, so the prune and the preload read the same
list.

**One pass per surface reads them.** `migrateRetiredDisplays` runs first in
`preprocessTrackConfigSnapshot`, ahead of every `Core-preProcessTrackConfig`
handler, so a handler reads current names: the multi-wiggle seed sees the
`LinearWiggleDisplay` entry a retired one became and keeps the `rows` it
folded. `JBrowseModel` runs it over the frozen `tracks` as well, where the
track selector reads them. Entries that collapse onto one type become one: an
entry written for the display beats one written for a retired type, a bare
stub yields to either, and among equals the first wins, in the first one's
place and under its id. That is `foldRetiredMatrixDisplay`'s precedence,
general.

`migrateSessionSnapshot(snapshot, pluginManager)` walks display instances. A
retired one is renamed and pointed at the id its successor mints, and what
`retiredState.lift` answers runs through the retired type's `migrate` and the
display's `retiredConfig` before it lands: in the `sessionTracks` entry in
place, or in `trackConfigDeltas`. `heightPreConfig` is every display's.
`mergeTrackConfig` lands a delta display whose id the base lacks on the base
display of its type, for a config.json that still spells a retired type with
an explicit id. A delta the app wrote names its displays by id alone, so the
migration re-keys an id a retired type minted (`bam-LinearPileupDisplay`) to
the successor's before anything merges, whether or not a view shows the track.

**What each display declares:**

- `LinearAlignmentsDisplay`: the four v4 band displays, each with its bands;
  a v4 `colorBy`; the v4.3.0 instance settings and the nested sub-nodes.
- `LinearBasicDisplay`: `LinearFeatureDisplay`, and its legacy slot values.
- `LinearGCContentDisplay`: `LinearGCContentTrackDisplay`, a byte-identical
  schema registered against `GCContentTrack`, with nothing to migrate.
- `LinearMultiSampleVariantDisplay`: `MultiLinearVariantDisplay` and the two
  matrix types in columns; the arrangement, the sidebar and `jexlFilters`. A v4
  layout's colours stay behind, since the colorBy palette wrote them.
- `LinearWiggleDisplay`: `MultiLinearWiggleDisplay`, its rendering names folded
  into a plot and `rows`, v4.3.0's and the betas' both; the v4 plot, scale,
  autoscale, domain, colours, summary mode, cross-hatches and resolution; the
  arrangement and the sidebar.
- `LinearMultiRowFeatureDisplay` and `LinearMafDisplay`: the arrangement and
  the sidebar, which only v5 betas wrote.

`legacySessions.test.ts` loads v4 sessions through `setSession` and reads the
live display.

## Consequences

- `addDisplayConfigMigration`, `foldRetiredMatrixDisplay`, `displayTypeMap`,
  `migrateConfigSnapshot` and `MIGRATED_DISPLAY_INSTANCE_KEYS` are gone;
  `migratedDisplayInstanceKeys(pluginManager)` reads the declarations for
  `jbrowse validate`. The alignments migration lives in the alignments plugin.
- A v4 session naming `MultiLinearWiggleDisplay` opens the track in its layout,
  plot, order, labels and colours. A clustered v4 VCF opens with its order,
  tree and focus.
- Still not carried: v4 wiggle `fill`, `minSize`, `invertedSetting` and
  `showSidebar`; an autoscale mode v5 dropped; a v4 variant row's hand-set
  colour; and the v4 variant settings besides the arrangement and filters,
  which load at their defaults.
- A `facet` left in a quantitative display's config, which only v5.0.0-beta.9
  wrote, still fails the load (ADR-157).

## Rejected alternatives

- **Aliases alone.** The entry keeps its old values: `multixyplot` fails the
  rendering enum, and a bare `MultiLinearWiggleDisplay` entry loses the rows
  the seed gives, since the seed ran before the rename.
- **Keeping the central table in product-core.** A plugin out of tree cannot
  add to it, and it listed the alignments renames a second time.
- **Fixing each migration where it stood.** The alignments bug came from one
  mechanism addressing a display by id while another renamed its type; one
  pass per surface, reading one declaration, is what keeps the next one from
  repeating it.
