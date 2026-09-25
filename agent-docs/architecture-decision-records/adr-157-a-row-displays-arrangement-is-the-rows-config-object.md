---
status: Accepted
summary: "A row display's arrangement (the row order, per-row labels, the cluster tree with its provenance and the clade focus) is its `rows` config object, `field | { field, domain, labels, tree, treeProvenance, kept }` from display-kit, which every product edits as a session delta, so undo, reset and a share link reach it and it survives unticking the track. Every arrangement writer flushes to the session at once (`persistConfigurationNow`), so a clustering run is one undo step, and Reset row order returns each member to what the config.json declares rather than to empty. The quantitative display moves first: `facet: 'source'` is `rows: 'source'`, a leftover `facet` in a display config fails the load, and `rowColor: { domain, range }` holds the colour a reader sets on a subtrack, painted on the row's identity channel for the mode. `TreeSidebarMixin` is the config-backed arrangement. The multi-sample variant displays move second, onto the field-less `RowArrangement` their rows being the samples, with names at the rendering mode's granularity and `rowColor: field | { field, domain, range }`. The multi-row feature display moves third: `rows.field` is the attribute it partitions on, and `rowColor: { domain, range }` is the one map of row colours, the config's and the dialog's. MAF moves fourth, onto the field-less `RowArrangement`, its adapter's guide tree drawn while some rotation of it lists `rows.domain` and never written to `rows.tree`, and `rowColor: { domain, range }` its label tints. `TreeSidebarMixin` then holds the row colours, the dialog's submit and the row derivation the four displays each carried, over hooks each supplies, and `LayoutTreeSidebarMixin` goes. The mark display moves fifth: `rows.field` on bar and point marks is the worker's one facet split laid out one row per value, `rowColor` its label tint, and `facet` keeps the labelled sections. Supersedes ADR-143's `facet` as the quantitative display's layout. No migration for configs; ADR-168 moves a session's arrangement into `rows`"
---

# ADR-157: A row display's arrangement is the `rows` config object, written as session deltas

## Status

Accepted (2026-09-23). Step 3 of
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md):
the quantitative display moves first, the multi-sample variant displays
second, the multi-row feature display third and MAF fourth, each gated on a
zero image diff. The mark display moves fifth, which is step 6 for bar and
point marks. Supersedes
[ADR-143](adr-143-one-quantitative-display-and-facet-is-the-layout.md)'s
"`facet` is the layout" and its `facet.domain` row order; the rest of ADR-143
stands. Builds on `130e41de08`, which made every product edit a track's config
as a session delta.
[packages/tree-sidebar/CLAUDE.md](../../packages/tree-sidebar/CLAUDE.md) and
[plugins/wiggle/src/CLAUDE.md](../../plugins/wiggle/src/CLAUDE.md) are the
operational docs.

## Context

The tree-sidebar displays kept a reader's arrangement in display state:
`layout` (the rows in order, each a whole record carrying its label and
colours), `clusterTree`, `clusterProvenance` and `subtreeFilter`, all MST props
on the display instance. The declared order sat apart from it in config —
`facet.domain` on the quantitative display, a `domain` slot on the others — so
one row order had two stores, a seed and a runtime copy written over it.

Display state cost an arrangement what config gives any other setting:

- **It died with the display instance.** Unticking and reticking a track
  dropped it, which is why `treeAreaWidth` was already config.
- **An author could not write it** in a config file or `displayDefaults`, and a
  session pinning rows wrote whole `layout` records.
- **The session's track-settings machinery never saw it.** Since `130e41de08`
  every product edits a track's config as a delta in the session
  (`trackConfigDeltas`), so the changes table, its reset and Admin → Save track
  settings to config reach a config member, and nothing in display state.

The tree has to move with the order. Held apart — tree in display state, order
in config — one clustering run is two undo steps, and a second view clustering
the same track leaves the first view's dendrogram describing rows it no longer
has.

The design doc was reviewed three times, and the third review named what a
move to config requires. An arrangement writer has to flush to the session
synchronously: the track's persist reaction waits 400 ms, and until it fires
the arrangement is not in the session, so a ctrl+z in that window undoes the
previous change instead. A reset has to compare against the base config, or a
reader's reset writes a `null` delta that erases the admin's declared order for
that reader (`trackConfigDelta.ts`). And the changes table has to summarise an
array rather than print a 2,500-sample order.

`facet` also meant two things. On the quantitative display it named the rows
themselves; on the variant displays it names bands of rows, and on the feature,
mark and alignments displays labelled sections. The design splits the two
levels: `facet` for labelled bands, `rows` for one row per value.

## Decision

**`rows` is one config object**, display-kit's `rowsConfigSchema`:
`field | { field, domain, labels, tree, treeProvenance, kept }`, with
`shorthand: 'field'` and `closed`, so `rows: 'source'` lifts to
`{ field: 'source' }`.

| member           | holds                                                                                  | written by                                                        |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `field`          | the field each value of which takes a row; empty draws no rows                         | the config, the Plot type menu                                    |
| `domain`         | the row order: the values listed lead, the rest keep the order they arrived in         | a clustering run, the arrangement dialog, Sort rows by score here |
| `labels`         | a label drawn in place of a row's value, by value                                      | the arrangement dialog                                            |
| `tree`           | the dendrogram, as newick                                                              | a clustering run, beside the order it produced                    |
| `treeProvenance` | the locus and settings `tree` was computed from; unset for a tree that arrived as data | a clustering run                                                  |
| `kept`           | the focus, by value; empty, or naming no current row, shows every row                  | a tree click, a key row                                           |

`labels` is core's new `stringMap` slot type, which the config editor edits
with a map editor of its own.

**One mixin.** `TreeSidebarMixin` is the arrangement over `rows`, with the
toggles, `treeAreaWidth`, the `runClustering` / `clusterRegion` / `sortRowsBy`
launch specs and the hover and canvas volatiles beside it. Its API —
`rowDomain`, `rowLabels`, `rowTree`, `rowTreeProvenance`, `rowFocus`,
`rowArrangementIsCustom`, `rowOrderWillDropTree`, `setRowOrder`,
`setRowLabels`, `setRowFocus`, `resetRowArrangement` and `root` — is what the
sidebar, clustering, the column sort and the menus read. It holds the
`rowColor` pairs too (`rowColors`, `baseRowColor`, `rowStylingIsCustom`,
`resetRowStyling`) and the dialog's submit, `applyRowEdits`, and it derives
the rows every display used to build its own way: `editableSources`, the
arranged rows the dialog edits, and `clusterableSources`, those narrowed to the
focus, over one pure `arrangeRows`. A display supplies `discoveredRows` and the
hooks its rows need — `expandRows` and `rowAlias` (the variant displays'
haplotypes, each answering to its sample), `identityChannel`,
`unlistedRowsSort` and `rowOrder` — and keeps its palette, bands and
`focusLegendEntry`. What a submit writes, `rowEdits` computes: an entry the
config holds stands unless the reader changed that row, a value changed back
to what the row shows with no entry of its own removes the entry, and a row the
dialog never showed keeps its entry; an order that moves no row is not
written. `LayoutTreeSidebarMixin`, which kept the arrangement in display state
for the displays not yet ported, went once MAF, the last, had moved. The
quantitative display, `MultiSampleVariantBaseModel`, the multi-row feature
display and MAF declare `rows` and `rowColor` and compose `TreeSidebarMixin`.

**Every arrangement writer flushes to the session.** `BaseTrackModel` gains
`persistConfigurationNow()`, and each `TreeSidebarMixin` action calls it after
writing, so a run's order, tree and provenance reach the session in one write:
one undo step, undoable the moment its tree appears
(`RowArrangementUndo.test.tsx`). The debounced saver reads the config when it
fires rather than when it was scheduled, the simpler form; an undo inside the
wait was already safe, since it re-resolves the config node and re-arms the
saver with what it finds.

**A reorder keeps the names it did not show.** `setRowOrder` writes the rows
it was handed ahead of every name the current order carries beyond them, so a
declared row no loaded region holds yet keeps its place behind the rows on
screen, and `rowOrderWillDropTree` compares the same merged order.

**Reset row order returns to the base config.** The session's
`baseTrackConfig(trackId)` hands back the entry a track's delta edits over,
hydrated: the config.json entry, or the `sessionTracks` entry for a track the
session owns (ADR-158). `baseDisplayConfig(self)` finds the display's entry in
it. `resetRowArrangement` writes every arrangement member back to that entry's
value and never touches `rows.field`. `rowArrangementIsCustom`, which offers the reset, compares the
order, labels, tree and provenance against the same entry. The focus does not
count, because it has a clear of its own, but a reset takes it with the rest.

**The quantitative display moves first.** `facet: 'source'` is
`rows: 'source'`, which `MultiQuantitativeTrack` seeds; `rows: ''` is every
source in one plot box. `rows.field` admits `source` alone, and a `facet` left
in a `LinearWiggleDisplay` config fails the load with a message naming
`rows: "source"` (`checkRowsField`), since loading it as an overlay would drop
the rows in silence. The model's `facet`, `isFaceted` and `setFaceted` are
`rows`, `isRowLayout` and `setRowLayout`, and `gpuProps`' `faceted` is
`rowLayout`. `setRowLayout` writes the field alone, so the arrangement survives
a trip through the shared plot.

**`rowColor` holds a reader's colour for a subtrack.**
`rowColor: { domain, range }` (`RowColor`, closed) pairs subtrack names
with CSS colours. Each lands on the row's identity channel for the mode, ahead
of the adapter's colour and the palette: `color`, the plot, or `labelColor`, the
tint beside the label, wherever a score gradient paints (density, and bars or
points under a `linear` or `log` colour). The arrangement dialog's Track color
and Label color columns are one Color column editing that channel. Its submit
writes the order and labels to `rows` and the colours to `rowColor` over the
entries the config holds, and the bulk editor no longer writes `group`, an
adapter attribute with no config home. The
`color: { field: 'source' }` overlay palette, the legend and the dealer are
unchanged; converging row colour is the design's step 4.

**The multi-sample variant displays move second.** Their rows are the samples,
so `rows` there is display-kit's `RowArrangement`, the five members with no
field and no shorthand, which `Rows` extends with `field`; `TreeSidebarMixin`'s
host is typed on the intrinsic one and reads either. The names are at the
rendering mode's granularity — a sample in allele-count mode, `"<sample> HP<n>"`
in phased mode, where a sample's name stands for its haplotypes — and
`parseRowName`, beside `expandSourcesToHaplotypes`, reads a haplotype name back
to its sample, so a focus naming haplotypes still asks the fetch for samples
without reading `sampleInfo`. Phased rows are the ploidy `sampleInfo` reports
plus any haplotype the order names, which stand in for the ploidy until it
lands. `rowColor` is `field | { field, domain, range }` (`VariantRowColor`):
the field is the samplesTsv attribute whose palette tints every row, as the
string was, ~~and the pairs hold the dialog's per-row tints, which the palette
still beats~~ and since
[ADR-160](adr-160-a-rows-colour-is-one-categorical-channel-on-the-row-axis.md)
the dialog's per-row tints are the entries of `field: "name"`, one keyspace per
object, so a tint set under the attribute palette turns every row's colour into
one. A `layout`, `clusterTree`, `clusterProvenance` or `subtreeFilter`
on a variant display snapshot, or a `domain` in its config, fails the load
naming `rows`.

**The multi-row feature display moves third.** Its rows are the values of a
feature attribute, so `rows` is the field-keyed `Rows` wiggle declares.
`rows.field` is what `partitionField` was: empty still picks an attribute off
the data, a `jexl:` expression derives one, and the display reads it raw into
the fetch, since a resolving read evaluates the expression against no feature
(ADR-066). `setRowsField` writes it and clears the legend's hidden categories;
the arrangement and the row colours stay, since a name keyed on another field
matches nothing and comes back with the field. The rows the config
does not list still sort, digits by magnitude, since discovered values arrive
in no order of their own. `rowColor: { domain, range }` (`RowColor`)
holds what `sampleColorMap` and the dialog's per-row `color` held: one map, so
the dialog shows the config's colours and writes its own beside them. An entry
paints the row's blocks; a row without one takes the palette where no `color`
slot and no `itemRgb` paint, dealt over the rows in the config.json's declared
order, so no arrangement recolours a row. The dialog stores a label only where
it differs from the derived `(no <field>)` label. `partitionField`,
`sampleColorMap` or `domain` in its config, the same three in a feature
track's `displayDefaults`, and a `layout`, `clusterTree`, `clusterProvenance` or
`subtreeFilter` on its display snapshot fail the load naming the replacement.
It has no Edit as JSON box, so no `setRowsSpec`.

**MAF moves fourth.** Its rows are the species, so `rows` is the field-less
`RowArrangement` the variant displays declare. The adapter's guide tree is
data, re-supplied on every load, so it never enters `rows.tree`, where a stored
copy would go stale behind an edited `.nh`: MAF overrides `rowTree` to answer a
run's `rows.tree`, else the supplied newick while some rotation of it lists
`rows.domain`'s species in that order, whoever wrote the domain. The guide tree
is parsed rotated towards `rows.domain` (`rotateNewickByDomain`), which finds
such a rotation whenever one exists, so the test is one pass over its leaves,
and `rowOrderWillDropTree` asks it of the order a write would make. A reorder no
rotation produces hides the tree and the rows follow `rows.domain`; one that
only turns a clade, a relabel-only submit and a partial order keep it; a reset
brings it back. The fetch key is the sorted `rows.kept`, read from config alone.
The worker resolves a focus naming none of the species the adapter lists to
every species and applies it as given on a track that discovers its species
from the blocks, and `sources` narrows the same way (`keptRows`,
`filterRowsBySubtree`), so the key reads no fetch result and the rows drawn are
the rows shipped.
`rowColor: { domain, range }` (`RowColor`) holds the label tint a reader sets,
over the adapter's `samples[].color`, and the arrangement dialog's colour column
edits that tint, where it had edited a `color` no renderer read. A
`domain` in its config or in a MAF track's `displayDefaults`, and a `layout`,
`clusterTree`, `clusterProvenance` or `subtreeFilter` on its display snapshot,
fail the load naming `rows`.

**The mark display moves fifth.** Its rows are a field's values, so `rows`
is the field-keyed `Rows`, beside `facet`, which keeps the labelled sections
with their chips, cap and hide. The worker splits on `rows.field` exactly as
on `facet.field`, the request naming it `facet`, and the display lays the
answer out one row per value in the arrangement narrowed to the focus
(`rowsLayout`); the row lane, `markRowHeightPx` and `bandTops` draw it
unchanged, so `rows: 'source'` draws what `facet: 'source'` drew
(`rowDerivation.test.ts`). `discoveredRows` are the keys the loaded regions'
section tables name, sorted as sections are, and under `rows: 'source'` every
source an adapter lists without reading a region (a multi-BigWig's files, one
`MarkGetRowSources` call per adapter config) with its label and colour, so a
file with nothing in the window keeps its row as on the quantitative display; `identityChannel` is
`labelColor`, since each mark paints the plot in its own colour; and a
clustering run compares the values the first drawing bar or point stands at,
binned in the worker by the quantitative display's rule, a column per pixel
averaging every instance over it and a narrower one counted in the column it
starts in (`binSpan`, `MarkClusterRows`). Beside a `facet`
the facet draws: on the same field that is the whole picture, and on another
it asks for bands of rows, which step 5 draws, so until then a notice says so.
A pileup or `row` field under `rows` is reported, its packed rows sharing their
value's row. An explicit `rows` on a mark display is one row per value, and
the display honours no other: a quantitative track's preprocessor writes
`displayDefaults.rows`, the `MultiQuantitativeTrack` seed `rows: 'source'`
included, onto the quantitative display's entry alone, as it does
`displayDefaults.facet`, so ADR-134 never routes either to the mark display.
Over a multi-BigWig the mark display therefore draws every source overlaid in
one band until Plot field's default writes `rows: 'source'` where nothing
already splits the features, and a `displayDefaults.rows` on another field
fails the load with the quantitative display's reason. Amended 2026-09-25 on
Colin's answer to call 10 of the row-model handoff: that default had been
`facet: 'source'`, a chip section per source. Bars over a
multi-BigWig pack nothing, so each such section held exactly one row, which is
the row axis; a facet is for bands holding more than one row.

**Edit as JSON speaks `rows`.** `ChannelSpec` takes
`rows: field | { field, domain }` beside `facet`, `color` and `filter`, and
`ChannelSpecDialog` refuses `facet` on a display with no facet and `rows` on
one with no rows. The box writes only the channels it changed, and `rows`
through the display's `setRowsSpec` — the field, then the order as a reorder
writes it — so the labels, the focus and a tree the order still describes
survive an edit to the colour beside them.

**A session spec writes the arrangement as config.** A quantitative track
entry's `rows` is a config slot, so it lands on the display config, and like any
channel with a shorthand it replaces the object whole, so it names `field` too.
`runClustering`, `clusterRegion` and `sortRowsBy` stay display props: each is a
one-shot trigger that clears itself.

## Consequences

- Two views of one track share the order, the tree and the focus, because
  config is per track. A run in one view rearranges the other, with the tree
  that describes it.
- `rows.domain` is both the declared seed and the arrangement. A reorder writes
  it, and a later run rotates its dendrogram towards it (`rotateClusterRun`
  reads `rowDomain`), so a run after a hand reorder keeps those rows as early as
  the topology allows. At parse, provenance alone decides rotation: a tree
  carrying it is a run's and already rotated, and one without arrived as data
  and turns towards `rows.domain`.
- An arrangement write is undoable at once rather than 400 ms later.
- An arrangement survives unticking, can be written in a config file or
  `displayDefaults`, shows in the track's changes table, and an admin publishes
  one through Admin → Save track settings to config.
- A focus naming no current row shows every row (`keptRows`), so the "No
  subtracks match the current subtree filter" hint and its button are gone.
- The changes table summarises a long list, map or string by its count and
  its head (`formatSettingValue` in `SettingsChangesTable.tsx`), so a
  cohort's `rows.domain`, its `rows.labels` and its `rows.tree` each take one
  line rather than printing every sample.
- A variant arrangement is by row name, so a clustering run after a hand
  reorder rotates its tree towards that reorder, as on the quantitative display,
  where it rotated only towards the declared `domain` before. A focus naming no
  current row shows every row, and in phased mode a legend focus names the
  haplotypes drawn; before, a group focused and then clustered in phased mode
  drew nothing, since the focus named samples and the rows haplotypes.
- gccontent composes this model and extends this schema, so its displays carry
  `rows` and `rowColor` where they carried `facet`, as dead there as `facet` was
  (ADR-143).
- No migration (v5 breaks compat) for configs; a session's `layout`,
  `clusterTree`, `clusterProvenance` and `subtreeFilter` move into `rows` and
  `rowColor` on all four displays
  ([ADR-168](adr-168-a-retired-display-is-declared-on-its-successor.md)), and
  the refusals below meet only a snapshot written some other way. `facet` in a
  `LinearWiggleDisplay` config fails the load. `layout`, `clusterTree`, `clusterProvenance` and `subtreeFilter` on a
  wiggle display snapshot name nothing the display declares, so a session
  carrying them opens unarranged; on a multi-sample variant display they fail
  the load, and so does a `domain` in its config, each naming `rows`. On the
  multi-row feature display they fail the load too, and so do `partitionField`,
  `sampleColorMap` and `domain` in its config. On MAF they fail the load, and
  so does `domain` in its config or a MAF track's `displayDefaults`.
- On the multi-row feature display a reorder or a dialog submit sees only the
  rows the loaded regions hold, and the names and entries it did not see stand
  behind them, so a declared order or colour map keeps the rows a window has
  not revealed. The arrangement dialog's bulk editor keeps only labels and
  colours, where `layout` kept any column pasted into it.
- MAF's guide tree draws while some rotation of it lists `rows.domain`'s
  species in that order, whoever wrote the domain, so a track the session owns,
  a relabel-only submit and a partial order written in the session keep it, and
  a reorder that only turns a clade keeps it where `layout` had dropped it. The
  one trade: a config.json `rows.domain` no rotation produces hides the tree and
  the rows follow the domain, where the `domain` slot kept the tree and let its
  leaves win. A MAF focus naming no current species shows every row on a track
  that lists its species; on one that discovers them from the blocks it applies
  as given, on the worker and in `sources` alike, since such a track lists no
  species before it reads, so a focus naming none the blocks hold draws no rows.
- A clustered tree lives in the track's config now, where it was display
  state. The session snapshot already carried display state into every
  autosave and share link, so the size is not new, only now in config. hclust
  writes `name:length` at four decimals, about 16 bytes a leaf and 10 an
  internal node, so a clustered 2,500-sample track carries about 65 KB of
  newick and 25 KB of `rows.domain`, about 90 KB, and phased, with 5,000 quoted
  haplotype rows, about 230 KB. The
  session's `current` copy is rewritten 400 ms after each change under a 5 MB
  cap, which one such track takes 2–4 % of; a share link deflates it 2–3×.
- A track the session owns has its `sessionTracks` entry as its base
  (ADR-158), so its palette is dealt over the `rows.domain` it was added with,
  and "Reset row order" returns to the arrangement and colours it was added
  with, as a config.json track returns to its declared ones.

## Rejected alternatives

- **Arrangement in display state**, `layout` for rows and section order moved
  to match. An arrangement is lost on untick, and a section order held apart
  from its field outlives it.
- **The order in config and the tree in display state.** One clustering run is
  two undo steps, and a second view clustering the same track leaves the first
  view's dendrogram describing rows it no longer has.
- **A `layout` config slot carrying whole row records.** The order, the labels
  and the colours each have a home: `rows.domain`, `rows.labels` and a colour
  object.
- **Keeping `facet` for the quantitative display's rows.** `facet` names
  labelled bands on every other display, so wiggle's rows would have left no
  word for a band of subtracks — `group`, which ADR-143 anticipated.
- **One hide mechanism for sections and rows.** `rows.kept` is a show-set and
  the design's `facet.hidden` a hide-set, because the two treat a newly
  discovered key oppositely: a show-set hides it and a hide-set shows it.
