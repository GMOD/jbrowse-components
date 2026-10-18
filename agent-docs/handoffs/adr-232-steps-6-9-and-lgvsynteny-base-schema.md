---
name: adr-232-steps-6-9-and-lgvsynteny-base-schema
description: "ADR-232 steps 1-5 are on main (2026-10-18, through 4bdf073e34). Next: LGVSyntenyDisplay sheds the slots a synteny block cannot use through a shared alignments base schema (Colin's call), then steps 6-9, then the external writers (ggjbrowse, jb2hubs)."
---

# ADR-232: what is left after step 5

[ADR-232](../architecture-decision-records/adr-232-a-predicate-lives-where-what-it-selects-lives.md)
and its todo (`todo/adr-232-config-predicates-and-bands.md`) carry the
decision. Steps 1-5 and two review rounds are on main; nothing is pushed.

## Next, in order

1. **LGVSyntenyDisplay sheds `sashimi`, `filter.junctions`, `modifications`
   and `baseColor`** (Colin, 2026-10-18: "lgvsynteny does not need sashimi in
   the intron sense"; he chose the shared-base option over a schema `omits`
   option). A synteny block has no introns, basecaller tags, qualities or read
   sequence, and its track menu already offers none of the four.
   - `LinearAlignmentsDisplay/configSchema.ts` (one `ConfigurationSchema`,
     slots at lines 113-257) splits into a base both displays extend and the
     alignments display's additions: `baseColor` (line 194), `modifications`
     (203), `sashimi` (249). LGVSyntenyDisplay's `configSchemaF.ts` sets
     `baseConfiguration` to the full alignments factory today (line 103).
   - `filter` needs the same split: a base filter without `junctions`, and
     `alignmentsFilterConfigSchema` extending it with `junctions`. Keep
     `connections` on the base: Colin expects synteny may draw connection arcs.
     `readFilterMembers`/`readFilterOf` derive from the alignments filter's
     definition; check the base still yields them.
   - The shared model reads the four through `configSlotViews.ts`
     (`showSashimi`, `sashimiHeight`, `sashimiPlacement`,
     `effectiveSashimiPlacement`, `showSashimiCounts`, `junctionFilter`,
     `modificationSettings`, `baseLayer`, lines ~160-370) plus
     `model.ts:3073-3080` (baseColor/modifications write) and `:3274`
     (sashimi height resize). LGVSyntenyDisplay's model needs a hook so those
     getters answer off/empty without reading an absent slot: `getConf` on an
     undeclared path reads `undefined` silently (ADR-232 Consequences), so
     grep every read.
   - Docs pages each schema generates, `PlotExamples.test.ts`'s pinned
     LGVSynteny keys (drop `baseColor`, `modifications`, `sashimi`),
     `ConfigSlotDefaults` snapshot, the ADR's Loose edges entry (remove it)
     and the Rejected table (record `omits` as declined, and why).
   - Check `website/scripts/specs/*` and `test_data` for LGVSyntenyDisplay
     configs writing any of the four.
2. **Step 6, the connectors' color:** `pileup.showConnectors` paints by
   `readConnectionsColorField` as the arcs do (`features/linkedReads/`), a
   picture change shot before and after.
3. **Step 7, `variants`** on the multi-sample variant display: `{ show,
   height, showLabels }` replaces `showVariantLane`, `variantLaneHeight`,
   `variantLaneLabels`, flagged `plot`; beta-only, no lift. jb2hubs'
   pangenome configs and `~/src/jb2hubs/website/src/components/pangenomeLinks.ts`
   update in step.
4. **Step 8, MAF `alignments`:** `{ show, rowProportion, showAllLetters,
   showAsUpperCase, showInversions, showAnnotations }`, flagged `plot`,
   lifting the v4 mafviewer plugin's `rowProportion`, `showAllLetters`,
   `showAsUpperCase`.
5. **Step 9, the sweep's "now" rows:** `squashToHeight` → `heightMode:
   'fit'` (LD, Hi-C; beta-only), `displayDirectionalChevrons` →
   `showChevrons` with a `retired` lift (v4.3.0).
6. **External writers, when ggjbrowse takes the next `@jbrowse/tables`
   release** (it bundles a published copy, `~/src/ggjbrowse/scripts/take-release.sh`):
   `showOnlyGenes` → `filter: { genes: 'only' }` (`R/synteny.R:715`,
   `tests/testthat/test-features.R:33`, `test-synteny.R:52`,
   `test-multiway.R:105`, `tutorials/rnaseq.Rmd:91`, `~/src/ggjbrowse/scripts/gallery.R`),
   `minorAlleleFrequencyFilter`/`maxMissingnessFilter` →
   `filter.minMinorAlleleFrequency`/`filter.maxMissingness`
   (`R/variants.R:37`), `singletons` → `alone` (`R/alignments.R:50`), and
   `autoplot.R:313,331`'s junction band, which still requires coverage.

## Settled this session (don't reopen without new evidence)

- **`filter.tags` stays a list of `{ tag, value }`.** A map with `*` was
  built and reverted on Colin's read; the bugs were fixed in the list form
  (memory `explicit-records-over-keyed-maps`).
- **Sashimi keeps the overlay by default**; its own lane is
  `placement: 'down'`, and every arc draws there while coverage is hidden.
  Colin may want a ggjbrowse-style lane above coverage instead of below:
  ask before building.
- **"Edit plot..." text is the whole plot** (`applyPlot(draft, { whole:
  true })`); an agent's `applyPlot(draft)` patches by write mode.
- Declined with recorded reasons: wiggle `aggregate` → `summary` (ADR-216),
  `color.scale: 'none'` (ADR-154), facet-only color fields (ADR-230),
  `extent` → `showExtent` (ADR-216), `treeProvenance` out of the plot
  (ADR-157), `modifications` into `baseColor` (comment at the slot), a bare
  string as a field everywhere (ADR-159/215), `encoding.row` → `lane` and
  one `labels`/`text` word (ADR-232 sweep), `coverage.minAlleleFraction`
  rename (ADR-232).
- Open, low urgency: give every color object the mark display's `breaks` and
  `missingLabel` (additive, can follow 5.0); the breakpoint overlay reads
  `filter.expressions` alone (ADR-232 Loose edges).
