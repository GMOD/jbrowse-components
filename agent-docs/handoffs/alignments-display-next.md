---
name: alignments-display-next
description: "What is left of the 2026-10-22 LinearAlignmentsDisplay review after its bug fixes, ADR-240 and that ADR's steps 1 and 5 landed: two ADR-240 calls only Colin makes (unmodified as a modification code, which connector setting renames), the ADR-240 steps the vocabulary handoff orders, four internal cleanups (themed getter twins, the internal ColorBy scheme object, a misnamed extent, test-only exports), two small behaviour questions (sized lanes shrinking the fit budget, a connector's right-click), and ggjbrowse's unpushed respell and stale published pages."
---

# LinearAlignmentsDisplay: next steps

The review that opened this thread fixed six bugs and settled the display's
end state as
[ADR-240](../architecture-decision-records/adr-240-the-alignments-display-speaks-vega-lite.md).
The order of ADR-238 work across every display, ADR-240's steps included, is
[vega-lite-vocabulary.md](vega-lite-vocabulary.md); claim a step there before
starting it.

## Calls only Colin makes

- **ADR-240 open 2: `unmodified` as a code.** `pileup.bases.unmodified.show`,
  or `code: oneOf ['m', 'h', 'unmodified']` in the layer's filter. The data
  picks implicit or called sites today (`modificationsMenu.ts`), so a
  methylation owner checks MM `?`-mode data first.
- **ADR-240 open 3: `pileup.connectors` beside `readConnections`.** Both draw
  mate links and differ in where; one name changes. `pileup.showConnectors`
  waits on this before it becomes a `{ show }` part, as step 1 left it.

## ADR-240 steps not landed

- **Step 2, the channel object:** ADR-241 landed its step 0 (`scale: 'none'`
  gone). Pass A and pass B are next in the vocabulary handoff; they carry
  `encoding.color`, `scale.names`, `scale.group`, the missing-value member,
  `pileup.bases` and `coverage.encoding.y`.
- **Step 2b, the quality fade as opacity:** `pileup.mismatches.encoding.opacity`
  over `baseQuality`; two uniforms and a subtract, checked by one run of the
  mismatch bench.
- **Step 3, filters as predicates:** waits on the whole-fetch A/B on
  `1000x.shortread.bam` on ada. `breakpoint.reads` is a new row namespace.
- **Step 4:** `pileup.readHeight` to `pileup.mark.height`.

## Internal cleanups

None changes a config path, so none waits on the v5 freeze.

- **Six themed getter twins in `model.ts`.** `colorPaletteIn`,
  `arcFeedsByGroupIn`, `sashimiFeedsByGroupIn`, `connectorFeedsByGroupIn`,
  `sourceSectionsIn` and `colorScalesIn` each repeat a getter with a palette
  for the SVG export; one themed bundle would replace them. `renderSvg.tsx`
  also re-derives the sashimi labels the model's getter answers.
- **The internal `ColorBy` scheme object** (`shared/types.ts`,
  `shared/alignmentsColor.ts` `colorByOf` / `colorFieldOf`) restates
  `color.field` in v4's scheme names, and the RPC arguments are still
  `filterBy` and `colorBy`. One field classifier serving color, facet, sort and
  predicates removes the translation. Coordinate with whoever runs step 2's
  pass A, which rewrites the same readers.
- **`tagValueExtent`** also covers MAPQ; it is `linearFieldExtent` by another
  name.
- **Test-only exports:** `PILEUP_PASSES`, `ARC_PASSES`
  (`GpuAlignmentsRenderer.ts`), `buildAlignmentsRegionMap`
  (`Canvas2DAlignmentsRenderer.ts`), and the upload-type re-exports in
  `renderers/rendererTypes.ts`.

## Behaviour questions

- **A sized or expanded lane still shrinks its siblings' fit slices:**
  `resolvedFitDefaultCap` counts it in `visibleGroupCount` though it lays out
  under its own cap. Whether it should is unmeasured.
- **A curved connector's right-click opens the browser menu.** ADR-225 chose
  that; the left click on the same connector selects a read, so whether to
  offer that read's menu is a product call.
- **No test harness reaches this display's SVG export**, so no test pins the
  chip-label fix (`renderSvg.tsx`).

## ggjbrowse

- Its local main holds the respell and engine pins for steps 1 and 5
  (`ca0b603`); nobody has pushed them.
- Its published tutorial pages still show `showSoftClipping` and
  `mark = "cloud"` until they are re-knit at a new `tutorials/JBROWSE_COMPONENTS`
  pin (memory `a-config-rename-reaches-ggjbrowse`).
