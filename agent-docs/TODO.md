# Active Work Items

**Updated:** 2026-05-21 | PRD.md holds invariants; this file is the categorized backlog.






## The synteny import form


Not working/overcomplicated ui now


## Synteny canavs export

- Use normal bezier drawing in svg export/canvas
- Try to improve beziers a bit in webgl/webgpu
- Significantly more pixel artifacts in webgl/webgpu when zoomed out
- Unclear how to reproduce: was side scrolling a lgv, synteny view was not updating, and gene glyphs were gone. maybe from lost context



## GWAS

recombination subtrack

## Refactors

why is renderermenuitems imported into gwas anyways, i thought we modularized it out to avoid having to use it at all in gwas


## Wiggle

Unclear if local sd autoscale working
Multiwiggle legend not fitting on screen


## Tests




  2. SVG export Blob + FileSaver mock — 10 files
  // @ts-expect-error
  global.Blob = (content, options) => ({ content, options })
  jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))
  This pair is verbatim in every ExportSvg*.test.tsx. A config/jest/svgExportMocks.js setup file
  (added to setupFilesAfterEnv for those tests, or imported once) would eliminate it entirely.

  3. ExportSvgLinearSyntenyView.test.tsx — raw saveAs.mock extraction
  Two tests in that file inline the raw saveAs.mock.calls[0][0].content[0] pattern instead of using
  the exportAndVerifySvg helper that's already imported. Easy cleanup.

  4. LGVSynteny.test.tsx and AlignmentsSort.test.tsx — hardcoded sleeps → waitFor
  Three 1-second setTimeout pauses in LGVSynteny and one in AlignmentsSort after expectCanvasMatch.
  These should wait on a specific condition rather than a fixed delay.

  5. BookmarkWidget.test.tsx — 14× // @ts-expect-error on session widget access
  A local type cast const bookmarkSession = session as SessionWithBookmarkWidget declared once would
  clean up all 14 suppressions. Same approach in DrawerWidget (5×) and SessionMenu (3×).

  ---
  Probably not worth pursuing

  - TextSearching.test.tsx local doSetup — it diverges enough from doSetupForImportForm (no clearView)
   that merging them adds an optional parameter and hides the divergence.
  - ExportSvgBreakpointSplitView 10s sleep — needs a proper render-complete testid on that view type
  first; can't safely replace it without knowing what to poll for.
  - Skipped tests — those are product decisions, not test hygiene.

  The biggest remaining bang-for-buck is #1 (6 files, pure mechanical) and #2 (10 files, moves
  boilerplate out of test files entirely).

## DRY codebase



  A. The theme bug may exist elsewhere. createJBrowseTheme(getConf(...)) appears in
  jbrowse-react-linear-genome-view and jbrowse-react-circular-genome-view too. Worth checking whether
  those also ignore session.themeName, because if so this is a cross-product bug, not a
  react-app-specific one. Same one-line session.theme fix likely applies.

  B. Hunt for the pre-existing snapshot failure I masked. When I ran pnpm test -u, three snapshots
  updated. Two were my menu changes — but the third (getSnapshot(root.jbrowse.assemblies[0]) in the
  adds track and connection configs to an assembly test) was failing before my changes and I silently
  accepted the update. Could be a real regression on webgl-poc from an earlier commit. Worth diffing
  the snapshot vs main to see what actually changed.

  C. Desktop has the same PreferencesDialog dup. jbrowse-desktop/src/components/PreferencesDialog.tsx
  is byte-for-byte the same as the one we just deleted. Desktop doesn't currently depend on
  @jbrowse/web-core, so it's a heavier lift (add the dep, change one file), but it would finish the
  consolidation. Same shape as what we just did.
