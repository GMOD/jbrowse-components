import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * One block set oriented for one follow: the axis the anchor window is read on,
 * the axis the moved row lands on, and the filters every scan applies, so
 * `pickFollowFeature` and `followWindowMapping` agree on which blocks are in
 * scope. The filters resolve to dictionary ids once; a name no dictionary holds
 * gives -1, which matches no block.
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
  // undefined skips the filter
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
    // keeps an all-vs-all track to the level's own mate assembly, whatever the
    // adapter returned; the mate lane in both directions, being the one every
    // adapter fills in
    mateAssemblyNameIds: data.mateAssemblyNameIds,
    mateAssemblyId:
      mateAssembly === undefined
        ? undefined
        : data.mateAssemblyNameDict.indexOf(mateAssembly),
  }
}
