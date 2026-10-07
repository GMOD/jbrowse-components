---
name: grammar-release-audit-2026-10-07
description: Five parallel audits of the grammar-of-graphics surface before v5.0.0 (schema, vocabulary, mark pipeline, plot write paths, docs and in-repo configs), every finding re-verified against main. Colin approved the five shape calls on 2026-10-07; the defect list and all five calls (ADR-214 to ADR-219, ADR-217 superseding 214) have landed; Manhattan `ld` to `r2` and the LD `showLabels` enum have landed too; the canvas `labels.name` to `text` rename waits on a call after a review priced it, and the featureField defects that review found, the two tag guards and the docs pass remain. Read before changing a display's grammar slots, the plot write paths or the JSON schema.
---

# Grammar-of-graphics release audit, 2026-10-07

Five Opus investigators ran read-only over main at `c21d633b1d`, one area each;
every finding below was re-read or re-run by the coordinator. Nothing here is
fixed yet. **Delete this file when the calls are made and the defects have
landed or moved to `ideas/`.**

## Direction, as the tree already decided it

The concept objects agree everywhere: every colour object carries ADR-151's
members, `scales.y` is one factory (ADR-142), `facet`/`rows`/`rowColor` are
display-kit's (ADR-157, 160, 207), every display edits them as one `plot`
(ADR-204), retired spellings are one declaration (ADR-171) and the JSON schema
is a second walk of the live objects (ADR-120). All 47 `plotExamples` on the 14
plot-bearing displays round-trip through `plot` → `applyPlot` → session delta →
reload unchanged, and `jbrowse validate` passes all 30 demo configs. What is
left is two displays that still spell a mark their own way, three policy seams
nobody has ruled on, a short defect list, and docs lagging the renames.

## Five calls that are breaking after 5.0.0

All five landed on 2026-10-07: ADR-214 as ADR-217 superseded it the same day
(a display names a key it does not declare on the console and draws without
it; the objects under it stay `closed` and refuse one), ADR-215 (`rows` and
every colour object write whole; `SampleRows` on the variant and MAF displays,
the field shorthand on LD and Hi-C colour), ADR-216 (the quantitative
display's `mark` is `span` not `heatmap`, `y` not `scoreField`, one `size`,
`mean` not `avg`, and `mark`, `interpolate`, `size` and `origin` in the plot
vocabulary), ADR-218 (the alignments read filter is the `filter` slot, a typed
`ReadFilter`; `rowGroups` a typed list; `showOutline` a `maybeBoolean`;
`modifications` typed beside it as `AlignmentsModifications`) and ADR-219 (a
multi-way lane order and choice are its `rows`, `LaneRows`).

Smaller renames in the same class: Manhattan's LD join writes the statistic as
the field `r2` (ADR-178, amended) and the LD display's `showLabels` is
`none | name`, both landed on 2026-10-07; `scales.y.type` versus `color.scale`
naming one idea two ways is recorded (ADR-151).

**Canvas `labels.name` → `text` waits on Colin.** He approved it with
"description keeps its own slot"; a review of the plan on 2026-10-07 found
costs the audit had not priced, each re-read:

- A top-level display slot named `description` is unreachable from a session
  spec's track entry or a share link: `applyConfSettings` writes a key the
  track declares to the track, and the track declares `description`
  (`packages/core/src/pluggableElementTypes/models/baseTrackConfig.ts:214`).
- `''` is how the worker's label config turns a label kind off
  (`plugins/variants/src/LinearMultiSampleVariantDisplay/laneDisplayConfig.ts`),
  where the multi-way `text` slot reads `''` as its name-else-ID default.
- `showLabels` names the two lines `name` and `description`, so
  `showLabels: "name"` would govern a slot called `text`.
- jb2hubs writes display-level `labels.name` into its hosted configs
  (`hubtools/src/featureDisplay.ts` in that repo), which older releases read,
  so `labels` would stay a permanent second spelling.

The narrower change that keeps the win is retyping `labels.name` and
`labels.description` as `featureField`, so a bare string names a field as it
does on `text` and `encoding.text`, with no rename.

## featureField, as the same review found it

The contract is `fieldReader`'s (`packages/core/src/util/fieldReader.ts`): a
name, a dotted path or a `jexl:` expression. Eighteen slots declare the type,
five of them through `colorChannelSlots`. Not every one honours it:

- **Wiggle `y` reads a bare `feature.get`** (`plugins/wiggle/src/util.ts:193`),
  so a dotted path or a `jexl:` there plots 0 everywhere in silence, against
  `website/docs/config_guides/slot_types.md`'s promise for the type.
- **No surface compiles a featureField's `jexl:`** (the JSON schema, `jbrowse
  validate`, the editor, load), and a failing one differs by reader: canvas
  `facet` throws the track (`collectRenderData.ts:30`), `rows` and
  `clusterField` read `''` for every feature
  (`packMultiRowFeatures.ts:217`), multi-way `text` logs and falls back to the
  name (`MultiWaySyntenyDisplay/model.ts`, `geneTextOf`).
- **`''` is per-slot**: off on a colour field, a facet and a mark's `text`, the
  display's own default on multi-way `text` and `rows.field`; the slot-types
  guide says nothing of it.
- Reported, not re-read: `lengthField`, `canonicalTranscriptField` and the
  transform steps' `field` are `string` slots that read a feature field by
  their own rules.

Two guards worth adding at the tag: a slot-path baseline from the 5.0.0
`config.json` that `autogen --check` compares against, since the schema deploy
publishes main and a slot removed without a `retired` entry is gone from the URL
next deploy; and the beta-only retired spellings deleted (`linkedReads`,
`useColorPercentile`, the mark display's `displayCrossHatches`/`minimalTicks`).

## Verified defects

All twelve landed on 2026-10-07; the last, LD and Hi-C colour refusing the
bare-string shorthand, went with ADR-215.

## Docs and in-repo configs behind the code

- `website/docs/config_guides/variant_track.md:209` teaches `LDDisplay`,
  removed in `53bb2b9551`.
- `mark_display.md:161` names `scales.y.autoscale` (now `domainQuantile`);
  `:333` and `slot_types.md:124` say an unset axis `title` derives, where the
  schema draws none (`valueScaleConfigSchema.ts:260`).
- `user_guides/edit_plot.md:25-35` and `agents_live_model.md:193` omit
  `unit`, `y`, LD and the chord display; `BaseDisplayModel.tsx:265` says a
  sub-schema key "replaces the whole object" where namespaces merge; ADR-204
  says LD declares no plot; ADR-120's frozen count is 67 against 69 today.
- `tutorials/chromhmm.md:316` writes `rows` and `height` on a display
  snapshot, which the app drops.
- `automating.md:165` (from `packages/core/src/util/tracks.ts:1146`) shows
  retired `showDescriptions`; `cli.md:283` lists `jexlFilters` for a flag
  whose source says `filter`; jb2export's comparative `--colorBy`
  (`products/jbrowse-img/src/main.ts:155`) names the v4 view key.
- Guides teaching a jexl colour callback where a `color` object draws the
  same picture with a key: `cookbook.md:129,164,449`, `variant_track.md:66`,
  `tracks.md:129`, `faq.md:145`, `customizing_feature_colors.md:7,93`.
- Configs: `demos/ecoli_pangenome` `showLabels: false` (4 tracks);
  `test_data/config_demo.json` tracks 19, 20, 253 and `test_data/tcga_cnv`
  carry `renderer.color1`/`renderer.labels`; `test_data/cfam2` and
  `sars-cov2` sessions carry `heightPreConfig`;
  `scripts/agent-demos/takes/synteny.md:108` teaches `colorBy`.
- Undocumented grammar slots: multi-way `laneLayers` and `text`, the mark
  display's `rowColor`, MAF's `rows`/`rowColor`/`y` in the config guide.

## Checker blind spots that let the above ship

`check-config-blocks.ts:207` keeps errors only (an unregistered display type is
a warning); display and `marks` fragments, JSON in tables, session fences,
commented JSON and the generated `config/` pages are never validated; the CLI
README is regenerated only on prepack. `jbrowse validate` also warns wrongly on
a categorical `displayDefaults.color` on a FeatureTrack, because it checks the
colour against the wiggle display's `'*': threshold` preset too
(`cookbook.md:226`).

## Settled, not findings

Colour-object members and `scale: 'none'` agree on every display;
`fieldPresets` names agree (`strand`, `identity`, `mapq`, `count`, `r2`,
`dprime`); the CLI's rule-list copy is byte-identical to the live one and
guarded by autogen; every shorthand has its schema branch; `null` resets agree
across paths on typed slots; SVG export shares the Canvas2D painters so no mark
lacks a twin; `startEnd` is render-core's, not config vocabulary; a new mark,
step type, scale kind, colour member or display type is additive in the schema
(the `if/then` dispatch passes unknown types); `displayDefaults` expand into
the display config so `plot` and "Reset track settings" see them; alignments
`layoutOrder`/`sortedBy` are not a second spelling of `rows.domain`, since
pileup rows have no keys; `displayMode`, `lodMode`, `conservationMode`,
`heightMode` are honest layout or fetch modes.
