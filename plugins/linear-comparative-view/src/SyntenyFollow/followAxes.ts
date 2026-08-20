import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * One block set oriented for one follow: the axis the anchor window is read on,
 * the axis the moved row lands on, and the two filters both scans apply.
 * `toMate` picks the direction — the query axis is the anchor's when the mate
 * row is moving.
 *
 * ONE FUNCTION BECAUSE THE TWO SCANS HAVE TO AGREE. `planFollowStep` picks a
 * block with `pickFollowFeature` and then maps the same window through
 * `followWindowMapping`; a block in scope for one and not the other is a plan
 * whose two halves are about different data. As two copies of this prologue
 * that agreement was a convention.
 *
 * Both filters resolve to dictionary ids here, once, so the hot loops compare
 * integers rather than strings over hundreds of thousands of blocks. A name no
 * dictionary holds gives -1, which is not a valid id and so matches no block —
 * the same answer the string compare gave, reached without a special case.
 *
 * `windows` is a LIST because the anchor row can be showing several contigs at
 * once, which is what a whole-genome overview is. One window is that list with
 * one entry, and the ids come back in the order they were asked for.
 */
export function followAxes({
  data,
  windows,
  toMate,
  mateAssembly,
}: {
  data: SyntenyFeatureData
  windows: FollowWindow[]
  toMate: boolean
  // undefined where the caller cannot name it, which skips the filter rather
  // than dropping every candidate
  mateAssembly?: string
}) {
  return {
    refNameIds: toMate ? data.refNameIds : data.mateRefNameIds,
    starts: toMate ? data.starts : data.mateStarts,
    ends: toMate ? data.ends : data.mateEnds,
    otherRefNameIds: toMate ? data.mateRefNameIds : data.refNameIds,
    otherRefNameDict: toMate ? data.mateRefNameDict : data.refNameDict,
    otherStarts: toMate ? data.mateStarts : data.starts,
    otherEnds: toMate ? data.mateEnds : data.ends,
    windowRefNameIds: windows.map(w =>
      (toMate ? data.refNameDict : data.mateRefNameDict).indexOf(w.refName),
    ),
    windowRefNameDictLength: (toMate ? data.refNameDict : data.mateRefNameDict)
      .length,
    // KEEPS AN ALL-VS-ALL TRACK IN ITS LANE — belt to the adapter's braces. The
    // fetch is single-axis, so nothing in the shape of what arrives says the
    // mates all belong to the level's lower row; that is a property of the
    // adapters we ship honoring `targetAssemblyName`. One that ignored it would
    // put every sample in a PanSN file here and send the row to another genome.
    // The MATE lane in both directions, being the multi-assembly axis and the
    // only one every adapter fills in.
    mateAssemblyNameIds: data.mateAssemblyNameIds,
    mateAssemblyId:
      mateAssembly === undefined
        ? undefined
        : data.mateAssemblyNameDict.indexOf(mateAssembly),
  }
}
