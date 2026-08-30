// Where the E. coli pangenome demo's data files live.
//
// Every pggb/minigraph figure reads this demo, and its files are rebuilt by
// scripts/build_ecoli_pangenome_graph.sh and then uploaded. Between those two
// steps the hosted copy is the OLD build, so a spec for a track the rebuild
// just added renders a "track not found" frame rather than failing, which is
// the worst way to find out. Point this at a local `npx serve` of the build
// output to render the new figures before the upload:
//
//   npx --yes serve -l 8081 --cors ecoli_pangenome_graph_build/jbrowse2
//   ECOLI_DEMO_BASE=http://localhost:8081 node scripts/generate-screenshots.ts \
//     --filter pangenome
//
// Leave it unset to render against the hosted demo, which is what a committed
// figure and its live link must both point at — `pnpm check-live-configs`
// fails on a figure whose config lives on no server.
export const ECOLI_DEMO_BASE =
  process.env.ECOLI_DEMO_BASE ?? 'https://jbrowse.org/demos/ecoli_pangenome'

export const usingLocalDemo = Boolean(process.env.ECOLI_DEMO_BASE)

// The five E. coli strains stacked in one LinearSyntenyView, with one
// all-vs-all track backing every band. Three figures draw this — minimap2
// (specs/synteny.ts), pggb and cactus (specs/pangenome{,_cactus}.ts) — and the
// ONLY thing that differs between them is which aligner's AVA track they name.
//
// Shared because that is the claim they make about each other. All three used
// to carry the same five props and the same row list, and each said in a comment
// that it matched the others "line for line" — a cross-reference three files
// kept by hand, which is the shape that drifts. Now they are one shape and the
// comparison is structural.
//
// IAI39 GOES LAST on purpose. The other four are near-colinear with each other
// (every pair >92% forward), so bands 1-3 are the shared-backbone picture and
// the bottom band is the only one with real structure: IAI39 carries five
// inversions over 50 kb against K12, the largest 281 kb and 350 kb, which draw
// as two clean X crossings rather than as noise. Reordering the rows moves the
// crossings off the bottom band and the figures stop being attributable to one
// strain.
//
// `minAlignmentLength` drops the short alignments so the shared backbone reads
// as clean ribbons instead of a dense noise band.
//
// `collapseEmptyRows` because none of the five rows carries a track, so every
// row collapses to a bare scalebar instead of a ~90px "No tracks active / OPEN
// TRACK SELECTOR" block — five of those cost more of the viewport than the
// ribbons they are stacked around, and the cactus figure shipped with them once.
//
// NO autoDiagonalize, and it was tried. It reorders and flips a level's lower
// axis, and neither lever applies: each assembly is a single contig, so there is
// nothing to reorder, and the flip is per-axis rather than per-block, so it
// cannot help a row whose inversions are internal (IAI39) — the render is
// unchanged. The slant is not a rearrangement to correct either: each row spans
// its own whole genome across the same pixel width, and the genomes differ in
// length (K-12 4.64 Mb vs Sakai 5.50 Mb), so a colinear alignment has to draw as
// a diagonal.
export function ecoliAvaStack(trackId: string) {
  return {
    type: 'LinearSyntenyView',
    views: [
      { assembly: 'K12' },
      { assembly: 'Sakai' },
      { assembly: 'CFT073' },
      { assembly: 'NCTC86' },
      { assembly: 'IAI39' },
    ],
    tracks: [[trackId], [trackId], [trackId], [trackId]],
    // An EXPLICIT false, not the unset default: since drawCurves became a
    // promotable track setting, this init key customizes each opened track,
    // and unset would mean "inherit the session default" — these FIGURES need
    // straight chords whatever the capture environment holds, because the
    // slant IS the signal on a whole-genome stack. The live ecoli_pangenome
    // demo deliberately omits it: a visitor's own pinned default may apply
    // there, and an explicit value would mark the track edited on every load.
    drawCurves: false,
    colorBy: 'default',
    minAlignmentLength: 10000,
    levelHeights: [110, 110, 110, 110],
    collapseEmptyRows: true,
  }
}

// Five collapsed scalebar rows and four 110px bands, which is what the stack
// above measures. One number for all three figures, for the same reason the
// shape is shared: their captions claim they are comparable line for line.
export const ECOLI_AVA_STACK_HEIGHT = 715
