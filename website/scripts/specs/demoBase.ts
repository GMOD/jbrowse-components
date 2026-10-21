import { pageTrack } from './pageTrack.ts'

// Point ECOLI_DEMO_BASE at a local `npx serve` of the pangenome build output to
// render new tracks before upload; the hosted copy shows "track not found" for
// them. Committed figures use the hosted demo, or `pnpm check-live-configs`
// fails.
const ECOLI_HOSTED = 'https://jbrowse.org/demos/ecoli_pangenome'

export const ECOLI_DEMO_BASE = process.env.ECOLI_DEMO_BASE ?? ECOLI_HOSTED

export const usingLocalDemo = Boolean(process.env.ECOLI_DEMO_BASE)

export function ecoliPageTrack(doc: string, trackId: string) {
  const track = pageTrack(doc, trackId, { base: ECOLI_HOSTED })
  return JSON.parse(
    JSON.stringify(track).replaceAll(ECOLI_HOSTED, ECOLI_DEMO_BASE),
  ) as typeof track
}

// Shared by the minimap2, pggb and cactus figures, which differ only in the AVA
// track. IAI39 stays last: its inversions are the only real structure, and
// reordering moves the crossings off the bottom band. autoDiagonalize changes
// nothing here, since each assembly is one contig.
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
    tracks: [trackId],
    // Pinned so the capture default cannot curve the chords; the slant is the
    // signal on a whole-genome stack.
    mark: { interpolate: 'linear' },
    filter: [{ field: 'length', gte: 10000 }],
    levelHeights: [110, 110, 110, 110],
    collapseEmptyRows: true,
  }
}

// Five collapsed scalebar rows plus four 110px bands.
export const ECOLI_AVA_STACK_HEIGHT = 715
