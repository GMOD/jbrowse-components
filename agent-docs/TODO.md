# PRD

When you complete an item in this document, remove from the document

## Migrate to pnpm 11 when released

pnpm 11 no longer reads settings from `package.json`. When it is released:

- Remove the `"pnpm"` field from `package.json`
- In `pnpm-workspace.yaml`, replace `onlyBuiltDependencies` list with an
  `allowBuilds` map:
  ```yaml
  allowBuilds:
    canvas: true
    electron: true
    electron-chromedriver: true
    esbuild: true
    puppeteer: true
  ```
- Move `minimumReleaseAgeExclude` to `pnpm-workspace.yaml` (drop
  `minimumReleaseAge: "1440"` — it is the v11 default)
- In all CI workflows, replace `pnpm install --frozen-lockfile` with `pnpm ci`
- Bump `version: 10` → `version: 11` in every `pnpm/action-setup` step across
  `.github/workflows/push.yml`, `release.yml`, `publish.yml`, `update-docs.yml`
- Check `website/.npmrc` — `ignore-workspace-root-check=true` may need to move
  out of `.npmrc` (which becomes auth/registry only in v11); find the correct
  `pnpm-workspace.yaml` key

## Fix prettier config

- It is saving files with quote and added semicolons. See ~/src/mysetup.nvim

## Dark reader doesn't look good sometimes

- with multiwiggle labels, it is white text on light background
- the dna letters are similar but it is white text on light color rects

## Occasionally large inertia for scroll zoom

Particularly after navigating to another tab, then returning to app, and zooming

Unclear why...js is slower on returning to app? event not firing as fast on
return to app?

It is NOTICEABLY slow to start the scroll zoom (like almost 500ms or even 1s for
the scroll zoom to start)

Profiling is hard because affect goes away when profiler active?

Might need detailed debug logging

This is exotic but it also makes me wonder whether a more targeted 'mobx class
based' lineargenomeview model would help. We are expecting realtime performance
out of mobx-state-tree which is tricky

## Plan for test stability

Keep seeing test errors. Increasing test speed is extremely valuable also

## Plan for performance

Need to make sure we have top performance. Collect chrome performance profiling
traces

## Minimize bundle size

Try to measure where there is unnecessarily large bundles

## plugins/canvas sometimes doesn't render features on initial load

Can see feature labels and there are mouseover rects "work" but they are over
'blank' areas of the screen because the actual features did not get loaded

## Check that 'renderer' url param is working

Not sure if it is

## Better design for human vs mouse style synteny

Need to design a system for good defaults

Look into circos, or other synteny plotting systems

## Also make it easier to just use arcs and coverage, no pileup rectangle reads viz

Want to make it easy to plot megabase scale data

Possibly a custom regiontoolarge dialog

Remove snp level clickmap when zoomed out super far also, no reason for it

If possible, with arcs, try to aggregate them to add nice mouseover?

Another concept: presets, similar to old display mode

## Better 'blue/green' connectors in the breakpoint split view

Looks weird, arbitrarily increases in y (goes down), then loops back up. need
more ideal squiggle connector

## 1000 genomes demo

Add more metadata, change to a 'folder' by default

## Add global 'config overrides'

E.g. allow show paired arcs by default on by default across all tracks

## Add single cell demo

Get data from GEO or something Run pipeline ourselves Figure this out :)

## Dotplot not rendering

Lost context? maybe initially renders but not subsequently?

## Methylation mode not working

Check

## Implement "Query name" color-by option for LGVSyntenyDisplay

Was listed in the color menu but marked TODO and never implemented. Removed the
option for now. If desired, implement coloring synteny features by query name
(hash query name to a color) in LGVSyntenyDisplay similar to how it's done in
alignments.

## Simplify and refactor all plugins repeatedly

packages/core plugins/gtf plugins/arc packages/app-core products/jbrowse-web
products/jbrowse-desktop etc.

## Continue benchmark-genotypes work

ld and multi sample

publish hclust also and merge

## Make HiC display multi-region capable

`plugins/hic/src/LinearHicDisplay/components/` currently uses a single-region
upload pattern (`lastRpcData !== data` outer guard, calls
`renderer.uploadData()` once). Needs to become per-region like
wiggle/alignments:

- Switch to `Map<number, HicDataResult>` for `rpcDataMap`
- Use `uploadChangedRegions` for per-region upload
- Pass `regionNumber` to `renderer.uploadRegion()` instead of monolithic upload
- Pass block array to `renderBlocks()` (currently passes a single region)
- Verify color scheme change still triggers re-upload

## Make LD display multi-region capable

`plugins/variants/src/LDDisplay/components/` same situation as HiC — single
region upload pattern. Steps mirror HiC above.

## MultiVariantDisplay per-region upload optimization

`VariantComponent.tsx` currently re-uploads ALL regions on every `cellData`
change (simplified in the last refactor because `perRegionCellData` is a plain
object, not a `Map`, and it was unclear whether its per-region values preserve
object identity across updates).

Investigate: does `computeVariantCells` return the same object reference for an
unchanged region when a neighboring region's data arrives? If yes, wire up
`uploadChangedRegions` (or the equivalent manual pattern) so only the changed
region pays the upload cost.

## Hash param for password in share links

On hash fragments and why your concern is more solvable than it looks:

The reason updateUrl currently strips the hash is this:

const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` :
window.location.pathname window.history.replaceState(null, '', newUrl)

But the password is only needed for a single moment — it's read at startup and
immediately deleted via deleteQueryParams([...paramsToDelete]) (line 102 in
Loader.tsx). So the hash would only need to survive until that useEffect fires.
The fix is:

// in Loader.tsx — also read and immediately clear the hash const hashParams =
new URLSearchParams(window.location.hash.slice(1)) const hashPassword =
hashParams.get('password') ?? undefined const password =
readQueryParams(['password']).passyword ?? hashPassword

And in deleteQueryParams / updateUrl, clear the hash at the same time:

window.history.replaceState(null, '', newUrl) // hash is gone, that's fine

Since the hash is cleared on first navigation (immediately), it's not a
long-lived thing that updateUrl needs to preserve. Old ?password= links keep
working as a fallback.

In ShareDialog.tsx the share URL becomes: locationUrl.search = params.toString()
// ?session=share-abc locationUrl.hash = `password=${result.password}` //
#password=xyz

## Clusting might not update UI properly in wiggle

investigate, or perhaps e.g. tree drawn before rows are clustered

## plugins/canvas should try to render some amount of offscreen contents

There is somewhat of a 'cutoff'. this could help avoid re-juggling features too
much on small zooms

Plugins/sequence added 'extra fetching' beyond just screen width recently also

## GPU: build-time WGSL struct size validator

6 structs across alignments, LD, and canvas plugins had sizeof not divisible by
16 and were fixed manually (ArrowInstance, ReadInst, GapInst, CovInst,
IndicatorInst, ConnLineInst, LDInstance). The runtime guard in
`WebGPUHal.create` catches these when the WebGPU path is hit, but a build-time
Jest test that parses WGSL sources and asserts
`sizeof(instanceStruct) % 16 === 0` would catch regressions in CI before they
reach a browser.

## Reduce frequency of check pending files

not sure if matters but could be useful

## NCBI gene track has lots of collapsed items

Need to fix

## Create more compact display mode

Can consider 'side labels' for genes

## webgl-poc does not have protein3d because of linearbasicdislpay concept. might need to be addressed

## No protein3d for BRCA1

No UniProt entries found for . Try a different identifier above, or search
UniProt directly and use "Enter manually" above, or use "Search sequence against
AlphaFoldDB API" if available.

No UniProt ID found

Clicking on all isoforms

## Padding on the right side of features on plugins/canvas

Still needed? maybe excessive

## Organize linearalignmentsdisplay menu

Might have a 'rarely used' menu? Set max track height for example, some rarely
used show items. I dunno

## Pack all display heights

Manual action similar to compact all tracks

## Slightly more subpixel modifications drawing

Gets a little crowded

## Disabling show descriptions show re-layout

Does not

## Do not want the show only genes on linearvariantdisplay

Might want to reevauate what 'base class' or base mst model is used

## Add super compact for gene glyphs

## Paired arcs 'not pointing down' do not display

## Add the options for draw inter-region arcs/long rang arcs

## Weird lack of 'long range arcs' to right of 1kg demo
