---
name: row-model-colour-and-mark-rows
description: State of the row-model thread at the 2026-09-23 evening handoff. Step 3 (one row model) is on main with the session-track base and a work census; two branches are open in worktrees, the step-4 colour object and dealer (unreviewed, mid-rebase) and rows on the mark display (reviewed, seven findings unfixed, one visible default to revert); nine calls are Colin's, each answered by a page not yet made. Read before touching a row display's colour, bands, the mark display's rows, or the session's track resolution.
---

# Row model: colour and mark rows, handoff of 2026-09-23

The thread is design-doc step 3 of
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md),
done, and steps 4 and 6 started. The design-pass plans for steps 4, 5 and 6 are
appended to that doc. Every piece went agent port → independent agent review →
fix round → a read by the orchestrating session → fast-forward land; every review
found a real defect the gates had not.

## On main (nothing pushed; main is at b3a53d8a3f)

- Multi-row review fixes, shared `rowEdits` and the order merge (`50e7e763f6`); the
  two multi-row misc goldens (`d96cf359ec`).
- One `RowColor` schema in display-kit (`0688554a79`).
- MAF on `rows` (`94a9547ede`…`65fc804d15`): the guide tree draws while some
  rotation of it lists `rows.domain` in order; a discovery-track focus applies
  as given, as the worker's does.
- Session-owned tracks have a base (ADR-158, `b64473a6b3`…`28a0c1f5e8`; per-id
  delta read `71b52a785a`…`56d847303f`): the `sessionTracks` entry is the base,
  edits are deltas, `tracks` is a held list, a write resolves one track, the
  core reference resolves to a per-(schema, id) working copy. Persist at 10k
  catalog tracks: 6 ms → 0.16 ms (config), 0.5 → 0.14 (session); base lookup
  216 µs → 0.4 µs; search keystroke 3.0 → 2.5 ms.
- The convergence pass (`398b624e33`…`3c18fb36ff`): six colour members and the
  arranger in `TreeSidebarMixin` over pure `arrangeRows` with hooks
  `discoveredRows`, `expandRows`, `rowAlias` (memoized per sample set),
  `identityChannel`, `unlistedRowsSort`, `rowOrder`; `LayoutTreeSidebarMixin`,
  `treeSidebarBase`, `rowDomainConfigSchemaFields`, `reconcileLayout` and the four
  per-display arrangers deleted; a submit writes no order that moves no row and
  skips rows the current list does not hold. Phased 5,008-row recompute 3.0 →
  2.4 ms.
- The work census (`7f19950f75`…`d262b3ccd2`): `packages/display-test-utils/src/workCensus.ts`,
  a `workCensus.test.ts` beside each display's `rowDerivation.test.ts`, and
  `products/jbrowse-react-linear-genome-view/src/trackWorkCensus.test.ts`. A
  rising count is a regression to explain. On day one it found the per-id delta
  read above, a phased relabel re-running the variants fetch autorun (unfixed;
  see below), and MAF recomputing `sources` twice on load (fixed on the colour
  branch, `eef4bb1152`).

## Open branch 1: `row-color-channel` (worktree `.claude/worktrees/row-color-channel`)

Ten commits on `b1b6b658b0`, HEAD `0ca84dd621`, tree clean, **not reviewed, not
rebased**. The agent was stopped while rebasing onto main; its last word was
"keep both sides: main's `colorReverseSlot` and my dealer" for the conflict in
`packages/display-kit/src/colorConfigSchema.ts`. A fresh `git rebase main` meets
that conflict again; keep both. What it holds, per the step-4 plan's first half:
named categorical palettes and a capture-time palette override
(`933516c2aa`, `9c892e6a2d`), `rowColor: field | { field, scale, domain, range }`
as one categorical channel on the row axis (`63d447b5cb`), ADR-159
(`af9501e1a6`), the `rowColorScale` census column (`4f18ca6183`), a census settle
fix (`4770fa6af1`), the MAF double-`sources` fix (`eef4bb1152`). Unknown: whether
its gates were re-run after the rebase began, whether the phased-relabel fetch
leak was found, and whether every golden is still a zero diff (the brief
required a browser run against pulled goldens on canvas2d and webgl). Next:
rebase, run the brief's gates, then the review routine (a fresh reviewer with a
diff cut from the merge base, then a fix round), then land.

**A multi-row row changes colour on a pan, on main and on this branch.** The
palette is dealt over the rows loaded now (`discoveredRows` on main,
`expandedRows` in `rowColorDeal` here), so panning to where an early-sorting
value such as rmsk's `RC` appears or goes recolours every row after it. Core's
`categoricalValueColor` states the rule this breaks and is the by-value
alternative. Left unfixed on main on 2026-09-23 because the fix is the
dealer's order and a visible palette change, which is call 1 below.

**Deferred until both branches land:** the retired-settings refusal and the
shorthand router are copied across multi-row (`retiredSettings.ts`,
`displayDefaults.ts`), MAF and `MultiSampleVariantBaseModel`, plus the
`MultiQuantitativeTrack` router `mark-rows` rewrites — one helper in
`tree-sidebar` taking the display type is about −50 lines. Multi-row's
`MultiRowSource` is `RowSource` field for field.

## Open branch 2: `mark-rows` (worktree `.claude/worktrees/mark-rows`)

Thirteen commits on `5fb2af80ad`, HEAD `c896d69cc0`, tree clean, **reviewed,
findings unfixed** (the fix agent was stopped before it changed anything). Main's
five commits past that base touch no mark-display file. The base already holds
main's three mark-display commits (`e3c92c9ed4`, `4f9ab04ae6`, `bc2175a8d5`:
zoom-range bins, a per-window field scan, a "rows cut" corner chip). Main has
since dropped the chip: `markRowHeightPx` squashes rows below a pixel once they
outnumber the plot's pixels, so no row is cut. On rebase, drop the branch's
`rowsBelowPlot` and `rowsCutNotice` with it. The findings, in order:

1. **The multi-BigWig default is a new picture, not a fix.** Main never routes
   the `MultiQuantitativeTrack` seed `rows: 'source'` to the mark display (its
   schema had no slot; ADR-134 routes it to the wiggle display alone), so main
   draws every source overlaid in one band, or under the Plot field default
   `facet: 'source'` chip sections. The branch draws one labelled row per source.
   Keep main's picture: in `plugins/wiggle/src/MultiQuantitativeTrack/displayDefaults.ts`
   run `refuseFacetShorthand` after seeding with its key widened to
   `['facet', 'rows']`, writing `{ rows, ...d }` onto the wiggle entry only; put
   the Plot field dialog's two `fields.rows` sites (`model.ts` ~1331, ~1574) back
   to `setFacetField(fields.facet)`. This also restores the load failure for a
   non-`source` `displayDefaults.rows` on a quantitative track (finding 3) and
   stops `rows-beside-facet` firing from a seed on `facet: 'strand'` (finding 5).
   The one-row-per-source default goes on Colin's page.
2. **The clustering matrix drops sub-bin features.** `buildMarkRowMatrix.ts`
   (~50-56) keeps only instances covering a bin's midpoint (a copy of multi-row's
   scalar path; its test pins `b: [0,0,0,0]`). The wiggle display's
   `getScoreMatrix` averages every feature overlapping a column and floors a
   sub-column feature into the column it starts in. Make one binning function in
   `packages/tree-sidebar` beside `clusterMatrix` stating the wiggle rule, fed
   from `encodeFeatures`' lanes with an index lookup per instance (no
   `RowInstance` object, no `keyOfRow` linear find); have wiggle call it if small.
4. **An empty subtrack loses its row.** `discoveredRows` (`model.ts` ~642-659)
   unions the split's keys from features. For `rows.field === 'source'` on an
   adapter reporting its sources, union the adapter's source list (label and
   colour as the row's own) as the wiggle display does.
6. Tests: a region arriving with a new value; the sort-at-column picture;
   `collectMarkRowMatrix` untested.
7. The tooltip under `rows` shows the raw `source` value (`facet.ts` ~102 →
   `MarkTooltip.tsx` ~126); `rowLabelOffset` (`MarkRows.tsx` ~12-35) duplicates
   `WiggleRowLabels`' rule, lift into wiggle-core; `packages/tree-sidebar/CLAUDE.md`'s
   present-tense display lists need the fifth display; `CLUSTERING_WORKFLOW.md`'s
   RPC list gains the mark RPC.

Fine per the reviewer: row geometry (sidebar, plot, axis bands, SVG share
`markRowHeightPx`), hooks (no fetch reaction runs on any arrangement step;
`rpcProps` reads only `facet` and `rows.field`), the census shape, the problem
rules, the lockfile (`@jbrowse/tree-sidebar` is a package dependency like the
other four).

## Decisions taken this thread (each in an ADR or the design doc)

ADR-157: the arrangement is the `rows` object; a repartition keeps the
arrangement; a reorder keeps the names it did not show; the dialog's submit
writes over the config's own entries and skips rows the current list lacks;
MAF's guide tree follows the rotation rule; a submit that moves no row writes
no order. ADR-158: session tracks have a base; `updateTrackConf` replaces the
last entry of a repeated id; a delta write resolves one track. On the colour
branch (ADR-159, unlanded): one `rowColor` channel, one keyspace per field, a
hand recolour under a non-`name` field materialises every row's resolved colour
(about 60 KB for 2,500 rows; kept in one function so it can change).

## Colin's calls, each answered by a page not yet made

1. The palette: a side-by-side of every candidate per display at 5, 20 and 100
   rows, plus a deuteranopia column (candidates and scenes in the step-4 plan);
   the one-look question: at 20 rows on a 1 px line and a 4 px block, which
   palette keeps every neighbour apart with nothing vanishing on white, and past
   its length, wrap or re-lit laps.
2. Label boxes always tinted on multi-row and rows-layout wiggle (on/off pair).
3. Variants' value order first-seen versus count-ranked (the legend both ways).
4. A field mapping versus a samplesTsv colour column (no fixture has one).
5. The hand-recolour-under-a-field materialisation above.
6. Band chips on the row displays (the 1000 Genomes matrix by population; four
   figures move).
7. A band field set over a clustered cohort: bands with an empty gutter and a
   re-run hint, or no bands and the tree kept.
8. Each band's dendrogram at full gutter width, or one shared depth scale.
9. `pile` or `stack` for the pileup channel replacing `encoding.row`; and
   whether hiding a band is config or stays volatile.
10. The mark display's default over a multi-BigWig (finding 1 above).

## Next steps, in order

1. `row-color-channel`: rebase, gates, review, fix, land (zero pixels).
2. `mark-rows`: rebase, the fix round above, a second read, land (zero pixels).
3. The two pages (the palette side-by-side; a tour of what steps 3–4 changed
   on screen: drag, cluster, undo, reset on an agent-built track, the MAF guide
   tree turning). No visible flip lands before Colin answers.
4. Step 4's second half per the plan: the legend by field value, retire
   `colorRowLabels` and `rowGroups[].color`, then the palette flip one commit
   per display naming its figures.
5. Step 5 per the plan (a tree per band; its zero-pixel half first).
6. Harden the hook seam: static hooks as mixin factory options, dynamic ones as
   getters, and a test that no display redefines a mixin member outside the
   declared list.
7. Small: the phased-relabel fetch-autorun re-run the census found
   (`plugins/variants` `workCensus.test.ts`, the relabel line); a phased dialog
   opened before the first cellData and submitted over haplotype rows still
   writes the sample order (harmless on screen, shows Reset);
   `BaseTrackModel.canConfigure` reads the whole delta map; the add-a-track
   census line still resolves every observed id.

## Environment

Nothing is pushed. Main's `pnpm verify --full` ESM build step is red from
another session's `plugins/sv-inspector/src/SvInspectorView/model.ts` (TS7006 at
~453 and ~471); every branch above is green on typecheck, verify and
test-related. Other sessions hold worktrees under `.claude/worktrees/` (desktop,
dotplot, lgv, load-latency, ramp table); leave them. The MAF and mark browser
suites have no goldens in `snapshots.lock`, so a local run of either writes a
fresh reference and passes; the two multi-row misc scenes have canvas2d and
webgl goldens but no webgpu golden. Reviewer scratch benchmarks and probes for
the session work live in this session's scratchpad
(`/tmp/claude-1001/-home-cdiesh-src-jbrowse-components/ead07680-fc81-4382-8947-5bec8c6e3a39/scratchpad/jest/`,
`probe/`) and may vanish with `/tmp`; the numbers are in ADR-158. The memory
index's row-model-port-thread entry points here.
