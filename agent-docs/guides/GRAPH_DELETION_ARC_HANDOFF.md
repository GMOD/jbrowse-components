# Graph deletion arcs: what shipped, what is queued behind a deploy

Written 2026-07-31, from the `pangenome/hprc_cfhr_deletion` review. Two repos are
involved: the figure and its prose here, the drawing in
`jbrowse-plugin-graphgenomeviewer`
(`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`).

## Done here, committed

- `pangenome/hprc_cfhr_deletion` draws the graph half in the **anchored** layout
  (`layoutMode: 'auto'`), not FMMM. The arc spans exactly the bp it removes, under
  the same coordinates as the hg38 row of the synteny panel above it. `pnpm
  autogen`-adjacent aggregates (gallery links, figure manifest) regenerated,
  caption and `### The Layout dropdown` heading in `pangenome_hprc.md` updated.
- `bubbleSpread` dropped from that spec: it is a floor in FMMM units passed to the
  remote engine only, so under a layout that runs locally it is dead and only put
  a no-op step in the figure's recipe dialog.
- **No linearized deletion track**, decided rather than deferred. Reasons in
  `reference/PANGENOME_GRAPHS.md` under Carriage.

## Done in the plugin, committed and NOT published

`36d5a5f fix(graph): dash the deletion arc, and put its label and its hit box on
it`, on top of the already-unpublished `ce96cd5` (graph context follows alleles,
default 1 hop).

- deletion arcs are dashed (`dashCurves`, de Casteljau sub-curves, period in
  screen px), because near-black rgb(24,24,28) and the off-reference charcoal
  rgb(60,65,72) read as one ink in a figure
- the label rides `curveMidpoint` of the curve the renderer strokes
  (`deletionArcCurves` is now the single derivation), instead of an apex derived
  from the bypassed nodes
- the label gate is the arc's drawn extent, not its bulge, so it stops depending
  on which layout ran
- `EdgeSpatialIndex` takes the bypassed map and bows its curves, so the drawn arc
  is hoverable and the chord it is not drawn on is not

Tests: 272 pass. `model.test.ts` and `renderPipeline.test.ts` fail to LOAD, and
`pnpm typecheck` is red, both inherited: the plugin resolves `@jbrowse/*` through
symlinks into this worktree, which has uncommitted `packages/core` edits
(`BaseFeatureWidget/configSchema.ts` is the import that throws). No error is in a
file this commit touches; confirm the same way rather than assuming.

## Next, in order

1. **Publish the plugin.** `pnpm betabuild` gates on lint + typecheck + tests, and
   typecheck is red for the reason above, so this needs the core tree committed or
   a build against a clean temp worktree. Do not skip the gate: it is what catches
   a bundle importing a host global that does not exist.
2. **Bump the pin** in the three `test_data/graphgenomeview/*.json` configs to the
   new content-addressed prefix betabuild prints.
3. **Regenerate every graph figure** in the same commit as the pin bump, and look
   at these three, which are what the plugin change is for:
   - `pangenome/hprc_lpa_kiv2` and `pangenome/hprc_amylase_graph` are force-layout
     figures whose captions say "the dark arc"/"the two dark arcs". Check the
     dashes read at figure scale, and that the labels now sit on their arcs.
   - `pangenome/hprc_cfhr_deletion`: the 2.2 kb and 9.3 kb arcs should regain
     labels under the extent gate. If 2.2 kb still has none, that is the gate
     working (it is ~11 px wide at this zoom), and the caption already says the
     shorter arcs are the other two deletions.
4. **Stale prose to fix with the same deploy**, from `ce96cd5`: the graph-context
   section of `pangenome_hprc.md` says the default is None, true today and wrong
   the moment the deploy lands, and its "2 hops" paragraph describes the old
   walk-the-reference rule.
5. Iterate against a local build with `GRAPH_PLUGIN_LOCAL=1` (see the header of
   `website/scripts/specs/graph.ts`) plus the plugin's `dist/` copied to
   `products/jbrowse-web/build/test_data/graphgenomeview/_localdist/`, which is
   the root the screenshot server serves. Switch back before committing figures;
   `pnpm check-live-configs` is the tripwire.

## Considered and rejected, with the reason

- **A force-layout equivalent of PangyPlot's `delLinkForce`** (push the bypassed
  nodes perpendicularly off the deletion chord so the layout closes the bubble).
  Not attempted: our force layout is OGDF FMMM in WASM, so the only equivalent is
  a post-pass that moves backbone nodes, and those nodes are shared with the whole
  thread. The three fixes above make a force-mode arc readable without moving
  anything; if the balloon-enclosing-nothing shape is still wrong after step 3,
  that is where to start, and `bubbleCrossing.test.ts` is the guard.
- **A deletion-arc LGV track** off the link index. See the reference doc.
