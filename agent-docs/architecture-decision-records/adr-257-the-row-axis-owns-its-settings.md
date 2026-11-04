---
status: Accepted
summary: "Everything about a row display's row axis lives under `rows`, as a Vega-Lite channel owns its scale, guide and sort: `rowHeight` is `rows.step: number | 'fit'` (`'fit'`, the default, divides `height` between the rows, as `heightMode: 'fit'` does), the sidebar `axis` is `rows.axis`, per-row colors are `rows.colors`, an override map beside `labels` that wins over the row-attribute color channel `rows.color`, `rowGroups` is `rows.groups`, `rows.kept` stays (row names, keyed) beside a new `rows.filter` (attribute predicates, not keyed), and `rows.tree` holds `{ newick, provenance }`. The variant display's `unit` becomes `rows.field: 'sample' | 'haplotype'`, haplotype a refinement of sample. A new declared write rule makes this safe: on `rows` and `facet`, a write that changes `field` unsets what names a row by its value (sort, labels, colors, tree, kept), so the layer below shows through, and merges the rest; what names an attribute stays. Amends ADR-238 and ADR-231; reverses ADR-194's row-height placement"
---

# ADR-257: The row axis owns its settings

## Status

Accepted (2026-11-02). Colin asked for the best grammar-of-graphics spelling
over a respell he judged on a technical reason ("this seems like a technical
reason over a grammar-of-graphics motivated reason"), with churn and lost
beta compatibility allowed. Eight reviews shaped it: three Fable (a cold read
of the surface, a design read, a naming read) and five Opus (mechanism twice,
grammar, writers, and an adversarial read of the write rule and the color
split against the code). Colin ruled the unit switch and the filter reset
(2026-11-02).

## Context

- A row display (variant, wiggle, the mark family, MAF) spelled its row axis
  across five top-level slots: `rows` (field and arrangement), `rowHeight`,
  `rowColor`, `rowGroups` and `axis`. Each `row*` compound named a path the
  grammar spells as a member, and `axis` was the row axis's guide sitting apart
  from the axis it guides, while the value axis is `encoding.y.axis`.
- What kept them apart was a write rule, not a grammar reason: `rows` takes a
  string shorthand and every settings bag replaced it whole, so `rows: "source"`
  would have reset anything folded in (ADR-231's reason for declining a
  shorthand on a band object, and the `rowColorConfigSchema` comment). Three
  sites already followed a better rule by hand: `rowsForField`,
  `facetForField` and `rowColorForOtherRows` reset what is keyed by the old
  field's values and keep the rest.

## Decision

| Before | After | Grammar |
| --- | --- | --- |
| `rowHeight` (`0` = fit) | `rows.step: number \| 'fit'`, default `'fit'` | Vega-Lite's word for one band's pitch, on the band scale, a number taking precedence over fit as it does there; `'fit'` is `heightMode`'s word with its one meaning; `height` stays the track, which never sizes itself from its row count |
| `axis { tree, branchLength, labels, width, grid }` | `rows.axis` | a guide nests under its channel, as `encoding.y.axis` does |
| `rowColor` `name` pairs | `rows.colors: { row: css }` | a per-row override map beside `labels`, ggplot2's `scale_*_manual(values = c(name = ...))` |
| `rowColor` over an attribute, or `name` with only a palette or `unknown` | `rows.color: { field, scale }` | a mapping from a row attribute through a scale; `encoding.color` stays the value color |
| `rowGroups [{ match, group }]` | `rows.groups` | derives the `group` row attribute (ggplot2's `group`) that `facet` and `rows.color` read |
| `rows.kept` | `rows.kept` stays (names, keyed); new `rows.filter` (attribute predicates, not keyed) | `kept` lists row names, which only a literal name can follow through the haplotype alias; `filter` is "a predicate drops" (ADR-238) over row attributes, ANDed, applied before `kept`, refusing `name`, `sampleName`, `HP`, `label` and `color` with a pointer at `kept` |
| `rows.tree` + `rows.treeProvenance` | `rows.tree`: newick, or `{ newick, provenance }` | one setting, written whole |
| variant `unit: sample \| haplotype` | variant `rows.field: 'sample' \| 'haplotype'` | what one row is, which `rows.field` exists to say |

`rows`, `rows.field`, `rows.sort`, `rows.labels`, `facet`, `height` and
`encoding` keep their spellings, as does MultiWaySynteny's top-level `axis` (its
lanes' x ruler) and the alignments display's top-level `unit: read | chain`,
which says what one drawn glyph is rather than what one row is. Members follow
capability: `step` where rows scroll (variant, the mark family), `groups` on
the mark family. The multi-way lanes' `rows` keeps the `sort` and `labels` it
already reads and keeps `kept`, a selection there (it replaces the configured
lanes and can add one) where on a row display it narrows; empty shows the
configured lanes. It takes no `filter`, and neither does MAF, whose rows carry
no attributes. Neither MAF's `rows` nor the lanes' takes a `field`, which
would be a one-value enum there (the lanes' `assembly` went 2026-11-04,
read by nothing).

One naming rule makes each member predictable: a plural member is a map keyed
by row name (`labels`, `colors`), a singular member is a channel or setting
(`color`, `step`, `filter`, `tree`), and `axis.*` holds the drawing toggles
(`axis.labels`, `axis.tree`). Each same-word pair names its sibling in its
description, and a refused shape or key names that description at load, on a
write and in `jbrowse validate`: a slot's `description`, and a sub-schema's
`description` option (`RowColor`, `RowTree`), so `rows.color: { HG002: 'red' }`,
`rows.colors: 'population'`, `rows.labels: false` and `rows.tree: false` each
point at their sibling. There is
no `axis.show`: turning off `axis.tree` and `axis.labels` leaves no sidebar.

- `rows.kept` has no carve-out: a list matching no row draws no rows and says
  so, where naming no current row drew every row, on the worker's MAF fetch
  too (`visibleSamples`). Empty still shows every row. The notice names the
  unmatched names only where the track lists its rows up front (VCF samples,
  configured MAF species, wiggle's subtracks); mark-family rows are found per
  window and MAF copy rows exist at some loci, so there it gives the count.
- `rows.filter` is declared where rows carry attributes (variant: samplesTsv
  columns; wiggle: subtrack fields; the mark family: `group`), and names an
  attribute, never compared with the current `rows.field`, which changes after
  load. Absent or `''` is missing and fails every test but `valid: false`.
- One narrowing (`rowNarrowing`: `filter`, then `kept`) feeds every reader:
  `clusterableSources`, the pruned tree, the variant fetch's samples, the
  "Showing N of M rows" chip and its line, and the tables export. An empty
  view's notice says which half emptied it.
- The chip's "Show all" clears `kept` and returns `filter` to the config's, so
  a filter the config states shows through, stated in the chip's tooltip;
  "Reset row order" restores both; "Show all rows" clears `kept` alone.
- A top-level `filter` entry on a row attribute (the variant and mark displays
  test records there) points at `rows.filter`, in the notice and in
  `jbrowse validate`. The validator sees no samples file, so it points only
  for attributes the config itself states (`group` under `rows.groups`, the
  `rows.color` field, a field `rows.filter` already tests); the live notice
  covers the rest.
- `rows.filter` refuses a row's identity (`name`, `sampleName`, `sample`,
  `source`, `HP`, `label`, `color`, `rowColor`) and a `jexl:` field, which a
  row has no record to compute over: a write throws, a config loads without
  the entry rather than as a test-less stub, and `jbrowse validate` reports
  it.
- A plot read returns `rows.tree` in its object form whichever form was
  written, so a wrapper handles one shape.

### Row sizing

- `'fit'` now names one behaviour in two slots: squeeze the content into the
  track's `height`. `heightMode` sizes a display's bands (a feature track, the
  variant display's records alone) and `rows.step` its rows; each
  description names the other. On the variant display the menus already keep
  them apart: Row height shows while rows draw, the records' sizing while
  none do.
- `rows.step` takes `bin.step`'s number-or-word slot type, so the CLI
  manifest, the JSON schema and launch args read one form. A step at or
  below 0 meets ADR-221's doors through the slot's `exclusiveMinimum`: a
  config loading names it once and loads as `'fit'` (what `rowHeight: 0`
  meant), a write refuses it pointing at `'fit'`, and `jbrowse validate`
  reports it. The R export writes `"fit"`.
- The Row height menu's first radio is "Fit to track height", alignments'
  words for the same choice; the submenu keeps "Row height".
- `step` sits where rows scroll, the mark family's and the variant display's
  `rows`; wiggle's and MAF's rows always fit and declare none.
- A schema may name the words a reader reaches for in place of a member
  (`misnamed: { height: 'step' }`), data the CLI manifest carries, so the
  load notice, a refused write and `jbrowse validate` all say "did you mean
  `rows.step`, the row height in px".

### Row colors

- Per-row pairs live only in `rows.colors`: `rows.color` refuses
  `scale.domain` under `field: 'name'` (the schema's `refuses`, met at
  ADR-221's doors). Under `name` it keeps the palette (`scale.range`, dealt
  to every row) and `scale.unknown: ''` (none), which "Each row" and "None"
  write. Under `name` the pins read as that palette's pairs, so a row's color
  resolves as it did when they were one object.
- A row takes `rows.colors[row]`, else `rows.color`, else the file's own color
  (MAF `samples[].color`, a listed source's color), else the palette.
- Under an attribute, a row `rows.colors` names leaves its value's swatch in
  the key and takes its own entry by label, where the key shows (a field, or
  rows sharing one panel); on stacked rows its label tint identifies it.
- The Color by choice is read off `rows.color` alone, so a pin never changes
  which choice shows: None is `field: 'name'` with `scale.unknown: ''` (or
  unset where no palette deals) and colors no row but the pins. Every choice,
  None included, writes `rows.color` and keeps `rows.colors`; the arrangement
  dialog's row swatches pin a color under any choice and leave the choice as
  it is. "Reset row order" returns the pins with the arrangement.
- `colors` is a member of `RowArrangement`, beside `color`, so the four row
  displays declare it and the multi-way lanes, whose `rows` is `LaneRows`,
  do not.

### The write rule

`writes` gains a declared form, data so the CLI's manifest carries it:
`{ keyedBy: 'field', keyed: [...] }`, on `rows` and `facet`.

- What names a row by its value is keyed; what names an attribute is not.
  `rows` keys `sort`, `labels`, `colors`, `tree` and `kept`; `facet` keys
  `sort` and `hidden`. `filter`, which names attributes, `groups`, `step`,
  `axis` and `color` stay.
- A write whose `field` differs from the stored field it writes over unsets
  the keyed members it does not itself state in the layer it writes, so the
  layer below shows through; a layer below whose keyed members name another
  field's values drops them from the merged result. A reset never writes the
  schema default over an admin's base.
- A write from or to an empty field resets nothing: `''` names no values,
  so a launch's `rows.sort=…` survives the data scan that picks the field,
  and wiggle's overlay toggle (`rows.field` `''` and back to `source`) keeps
  the order. A bag writing `''` and then another field keeps a stale
  arrangement; no menu writes that sequence.
- A refinement is not a field change: variant `haplotype` rows name their
  sample (`rowParent`), so a sample-keyed arrangement applies across the
  switch and `resettingRowsOnUnitChange` goes.
- Members outside `keyed` merge per member, `null` resetting one, and
  `rows: null` resets the whole object.
- A `sort` written on the same field without `tree` keeps the tree: the
  sidebar rotates it toward the order and draws it only while its leaves are
  the drawn rows (`treeDescribesRows`), so no writer has to clear it.
- `setConf` on a keyed object's `field` path applies the rule, as a bag does.
- The share-link delta emits `field` beside any keyed member it emits, so a
  base that later changes field still shows the user's arrangement on the
  field it names: the user's field and order win, and the base's new field
  and its arrangement drop.
- In user docs: writing `rows` changes only the members stated, and `null`
  clears one; a write that changes `field` first clears what names the old
  rows (`sort`, `labels`, `colors`, `tree`, `kept`) except
  what it states.
- Objects whose members are alternatives (`encoding.color` `value | field |
  datum`, size, opacity) and one-action objects (alignments `sort`) stay
  `writes: 'whole'`; `rows.color` is whole. `rows.tree` is keyed by its
  `newick`, `provenance` its one keyed member: a provenance describes only
  the newick beside it, so another newick, written as a member, a bag, a
  launch arg or a plot edit, drops the provenance it does not state. Whole,
  a member write of `rows.tree.newick` kept the old run's provenance.
- One pure helper serves `mergeConfSettings`, `writeConfMember`, the share
  link delta (`trackConfigDelta`) and the CLI's `mergeBySlots`, whose
  `mergedSlots` gains the keyed form and unions the keyed lists across a
  track's displays; `rowsForField`, `facetForField` (its `''` case and
  `records.facet` included) and `rowColorForOtherRows` become a field write
  through it. A parity test pushes one table of (base, write) cases through
  all four and expects one result.
- A plot read never folds a keyed object to its shorthand, so `plot.rows.step`
  is always reachable; a launch modifier lifts `rows=source` beside a
  `rows.*` member to `{ field }`, and `writeMembers` seeds a keyed object
  with its field and the whole members a write reaches (`rows.color`).
- Edit plot's whole write applies the keyed reset when its `field` changes,
  counting a keyed member whose text equals the read as unstated, since a
  plot read states every member.

## Rejected

| Proposal | Why not |
| --- | --- |
| `rows.height` for the pitch | `height` would mean the track one level up and a row one level down, and on the variant display `records.height` is a band's total beside it; IGV, igv.js and igvR say row height, so the description leads with "Row height in px" and a write of `rows.height` or `rowHeight` is refused with a pointer to `rows.step` |
| `rows.pitch` or `rows.size` for the pitch | `pitch` is no grammar's word; `size` is a mark's channel. `step` is d3's and Vega's band-scale step and Vega-Lite's `height: { step }`, the px from one band's start to the next; its doc says so, and the mark display's `bin.step` is the same idea along the genome, in bp |
| `height: number \| { step, max }` | `{ step }` sizes the view from its row count, which no multi-row display does (reference/ROW_HEIGHT_AND_FIT.md) |
| `rows.domain` for the shown rows | a discrete domain also orders in Vega-Lite and ggplot2, every other `domain` sits under a `scale`, and older ADRs used `rows.domain` for the order |
| Per-row colors as `rows.color.scale` name pairs, one channel | an override is not a mapping: `colors` pins a row whatever the channel maps, as `labels` pins its text, so a reader can color by population and still mark one sample; one channel made the two exclusive |
| `rows.step` unset meaning fit | `'fit'` written is a value a plot read shows, a launch arg spells (`rows.step=fit`) and R can write, where an absent member is none of these |
| `heightMode: 'fit' \| 'fixed'` on the row displays, `rows.step` the pitch `fixed` uses (with or without a fit ceiling) | on the variant display one `heightMode` would govern the records alone and the rows by turns, `grow` valid in one and not the other; a lone `rows.step` under `fit` would write nothing; the ceiling is capability nobody asked for, and its arrival is what would make `heightMode` the slot (reference/ROW_HEIGHT_AND_FIT.md) |
| `rowGroups` as a `transform` step | the mark display's `transform` runs on feature records; a second meaning for the word |
| The keyed rule on every shorthand object | an object of alternatives would merge `value` over `field` into both |
| `facet.collapse` | `facet` is shared by displays the collapse means nothing on; `pileup.collapsed` (ADR-240's 2026-11-01 amendment) is on the band it reshapes |
| Resetting a keyed member to the schema default | it wrote over an admin's base arrangement, which the variant unit switch restored until now |
| One predicate list holding name and attribute entries (`rows.kept` as `rows.filter: [{ field: 'name', oneOf }]`) | a clade pick, written whole, copied an admin's attribute entries into the user's share-link layer; per-entry keying needed special cases in five consumers, and only literal names can follow the haplotype alias (owner, 2026-11-02) |
| Resetting the whole `filter` and `groups` on a field change | an attribute predicate is valid on the new rows, and a reset `groups` left `facet: 'group'` and `rows.color: 'group'` reading nothing |
| Stamping the picked field beside a keyed member write | the display stores the field it picks (`applyDefaultPlot`), so no state needed it, and it wiped a launch's sort when the scan picked the field |
| Deprecated lifts for the beta-only keys | beta configs and share links may break (Colin, 2026-11-02); the v4 lifts (`showTree`, `showSidebarLabels`, `colorBy`, `renderingMode`, `liftRetiredRowState`) are retargeted |

## Parked

Found by the reviews, not built here: a "Keep rows where…" menu writing
`rows.filter`, which config, launch args and R write until then; `filter` on
MAF once its rows carry attributes; negation and a regex `match` in the
shared predicate grammar, which would let `rows.filter` hide one row and
`rows.groups` become predicate entries (`{ field, oneOf | match, group }`);
`groups` on the variant display; `rows.sort` by a row attribute; a tree read
from a file (`rows.tree: { uri }`); labels from a row attribute.

## Consequences

- A share link or `displayDefaults` writing `rows: "source"` keeps `step`,
  `axis` and `color`; one restating the field it already has keeps the
  arrangement, where it used to clear it.
- Ticking phased on a variant track keeps a hosted population sort, where it
  used to reset to the base.
- Beta share links lose `rowHeight`, `rowColor`, `rowGroups` and `axis` with a
  console notice, and keep `rows.kept`; one naming no current row now draws
  none, with a notice, where it drew every row. jb2hubs' hosted displays lose
  row colors and grid on a beta host older than the respell.
- A track-wide `rows.axis` on a quantitative track reaches its wiggle display
  alone, as its `rows` always did (wiggle's `rowsShorthand`), where a
  top-level `axis` reached its mark display too; that display draws rows only
  from a field of its own.
- Same-word pairs inside one object (`rows.labels` map and `rows.axis.labels`
  boolean, `rows.tree` and `rows.axis.tree`) name each other in their
  descriptions.
- ggjbrowse boxes only character vectors and gains a `jbrowse_rows()` helper.

## Order of work

1. The keyed write rule in core, with its CLI (`mergedSlots`, the manifest's
   keyed lists) and delta copies, the parity test, the plot read and
   launch-args fixes; adversarially reviewed against the parity table before
   it lands.
2. `facet` takes the rule, `records.facet` included.
3. The `rows` fold, one setting at a time across every row display, the
   variant display included, since each is declared or read once in shared
   code (`rowHeightConfigSchemaFields`, `rowColorConfigSchema`,
   `TreeSidebarMixin`): `rows.axis`, `rows.step`, `rows.colors` and
   `rows.color`, `rows.groups`, `rows.kept` and `rows.filter`, and
   `rows.tree`. Each slice moves the in-repo configs, figure specs, tests
   and docs with it.
4. The variant display's `unit` as `rows.field`, haplotype refining sample;
   MAF's `rows` drops the one-value `field` it inherits through `SampleRows`.
   Settled 2026-11-02, built 2026-11-02 (below the list, what the code
   decided where this note did not):
   - One flat `rows.field: 'sample' | 'haplotype'`: phased clustering
     interleaves haplotypes of different samples, which a nested spelling
     (a y offset, a `rows.split`) cannot express. Public docs say a haplotype
     row answers to its sample's name, and that the variant display's
     `haplotype` is no column, unlike a mark display's `rows: 'haplotype'`
     over a BED; they do not say "refinement".
   - Declared as data: `KeyedWrites` gains an optional `refines`
     (`{ haplotype: 'sample' }`, finer to coarser), declared on the variant
     rows' `writes` alone. `changesKeyedField`
     (`packages/add-track-core/src/keyedWrites.ts`, plain inequality today)
     reads a `refines` pair as no change in either direction; `mergedWrites`
     unions `refines`, a conflict falling back to `'whole'`; the schema check
     refuses a chain, a self-map and a value the enum lacks. The parity table
     gains refinement rows through all four consumers
     (`mergeConfSettings`, `writeConfMember`, `trackConfigDelta`,
     `mergeBySlots`), and `resettingRowsOnUnitChange` goes.
   - A switch normalises no state; a read interprets it, since the CLI and
     the share-link delta cannot see the sample list and normalising loses a
     phased interleave. `RowAlias` becomes a row-parent hook read off the
     row's own `sampleName` and `HP`, not parsed from its name.
   - `sort`: a row ranks at the earlier of its own and its sample's entry, so
     the latest reorder in either mode wins; collapsing, a sample ranks at its
     first haplotype entry (`orderByRank`; today a phased clustering order
     falls back to file order in sample mode, and a sample-mode reorder over
     haplotype entries leaves them interleaved on the way back).
   - `labels` (Colin's ruling, 2026-11-02): an own-name entry shows exactly
     its text (`'NA12878 HP1': 'paternal'`); else a sample-keyed label
     composes with the haplotype (`Mother HP1`); a haploid single row takes
     the bare sample label; haplotype entries persist unseen in sample mode.
     `arrangeRows.test.ts` pins today's replacing behaviour.
   - `colors`: as `labels`, a sample entry coloring its haplotypes and
     haplotype entries persisting unseen in sample mode, with nothing
     inferred from agreement.
   - `tree`: sample leaves expand to zero-length forks over haplotype rows; a
     haplotype-leaf tree in sample mode hides with a hint naming that reason,
     not "rows changed since clustering".
   - `kept`: two-way, as `keptRows` already is.
   - Haplotype numbering is 1-based, `<sample> HP1`, `HP2` (Colin's ruling,
     2026-11-02), matching multi-way synteny's #1/#2 and WhatsHap/HPRC. The
     schema, the CLI manifest and the user guide state the row name's
     spelling, and the docs say it is JBrowse's numbering, not the VCF's
     `HP` tag.
   - MAF copy rows compose labels the same way (`Mouse copy 2`).
   - A sample whose name parses as another's haplotype (`X HP1` beside `X`,
     `parseRowName`) warns once.
   - Tests: a phased → sample → phased round trip for `sort`, `labels`,
     `colors` and `tree`; the name collision; `rowArrangement.test.ts`'s pin
     of the old reset inverted, not deleted.
   - Built: `RowAlias` stays the name-to-name lookup the readers share, now
     derived by the mixin (`rowAliasOver`) from a display's `rowParent(row)`
     (`{ name, labelSuffix }`) and `finerRows`, the rows a finer field
     draws; the variant display's are the haplotype rows phased mode would
     draw (`finerHaplotypeRows`, a stable-identity computed so a focus
     re-arranges nothing new), in both modes, so a focus on a haplotype
     keeps its sample row while the ploidy has not landed. The fetch's
     samples and the tables export's narrowing read `entryAliasOf`
     (`parseRowName` over the sample list): the fetch must not read the
     ploidy the drawn rows need. MAF keeps its own name-parsed `rowAlias`,
     since a copy row exists at some loci only, and its `labelSuffix` is
     ` copy 2`, as its own copy label reads, so a sample label composes as
     `Mouse copy 2`.
   - The row's `HP` field stays the allele index from 0, which the worker
     and the genotype readers index by; the name (`haplotypeRowName`) and
     the tables export's `haplotype` column count from 1, 0 on a sample row.
   - The tree hint is a mixin hook (`finerTreeHint`), shown where
     `treeOnFinerRows`.
   - MAF's `rows` is `RowArrangement`, which declares `axis`, `colors` and
     `color`, and writes member by member; `Rows` extends it with `field`,
     `filter` and the axis `grid` (first built as a `MafRows` restating
     `Rows`' slots, folded 2026-11-04). `SampleRows` stays as a deprecated
     subpath no display extends.
   - The CLI's `mergedWrites` keeps a refinement only where every keyed
     declaration states it, not the union with a conflict writing whole: one
     merged slot serves every display a bag reaches, and a VariantTrack's mark
     display reads `sample` and `haplotype` as columns, so the CLI's merge
     drops the arrangement on that switch, which the variant display's own
     merge keeps.
   - A haploid sample's one row is marked `sole` where the expansion builds
     it, and only that row drops the haplotype from its label; a samples
     file's `label` composes as a `rows.labels` entry does (`Mom HP1`).
   - A v4.3 phased session named its rows from `HP0`; the lift renames its
     `layout` rows, `clusterTree` leaves and `subtreeFilter` from each layout
     row's `baseName` and `HP`.
   - A supplied tree rotates towards `rows.sort` before its sample leaves
     fork, since the order names the sample.
5. Writers: menus, launch-args, jbrowse-img, the tables and R export, the
   agent prompt (`jbApi.ts`, which says `rows` and `rowColor` write whole and
   lists `unit`), figure specs, tutorials, jb2hubs, ggjbrowse. jb2hubs'
   repeat-class displays (`columnDisplays.ts`, `repeatClassDisplay.ts`) and
   ggjbrowse's `R/variants.R` write per-class colors as `rowColor.scale`
   `domain` and `range` pairs; respelled, those are a `rows.colors` map, not
   `rows.color.scale` pairs, which `field: 'name'` refuses.
