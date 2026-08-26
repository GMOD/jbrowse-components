// The SV-channel arrangement, kept in a leaf module with no UI imports so it can
// be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's arrangement by its menu label. Same reason
// compactnessPresets.ts is its own module.

import type { GroupBy } from '../../shared/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'

/** What the arrangement READS, to decide whether it is in effect. */
export interface SvChannelsSettings {
  showPileup: boolean
  groupBy: GroupBy | undefined
  readConnections: ReadConnectionsMode
  drawProperPairArcs: boolean
}

/**
 * What a preset WRITES, which is not the same shape.
 *
 * `readConnections` is a promotable sentinel: its getter always resolves — to
 * `promotedBase` 'off' when nothing is set — while its setter also takes
 * `undefined`, meaning UNSET. Only the write side can say that, so only the
 * write side has the wider type, and a preset asserting `SvChannelsSettings`
 * could not express "hand this back to what it was inheriting" at all.
 */
export type SvChannelsWrite = Omit<SvChannelsSettings, 'readConnections'> & {
  readConnections: ReadConnectionsMode | undefined
}

export const SV_CHANNELS_LABEL = 'SV channels (pairs by orientation)'

// One band per pair orientation, each with its own coverage and its own arcs,
// concordant pairs left out. Every setting is reachable from the other menus;
// the preset exists because five of them spread across four menus is not an
// arrangement anyone finds by looking.
//
// `colorBy` is deliberately NOT among them, though the arrangement wrote it
// until 2026-08-26. With the pileup hidden there are no read fills to paint:
// the arcs take `arcColorByType` and the coverage band reads `colorBy` only
// under a modification or bisulfite scheme (executeRenderAlignmentData's
// `trackStrands`/`bisulfite`). So the one setting that cost a reader their
// methylation or insert-size coloring on the way in, and reset it to `normal`
// on the way out, was also the one changing nothing in the picture.
//
// `readConnectionsDown` is in NEITHER preset, and that is the same statement
// `isSvChannelsActive` makes by not matching on it: which side of the coverage
// the arcs hang on is a framing choice the arrangement has no opinion about.
// Writing it was the read and the write disagreeing — flipping the side kept
// the row ticked, then leaving and re-entering silently reverted the flip — and
// on the way out it pinned an explicit `false` over a slot whose unset state
// resolves to `true`, so a track that had never been near this menu came back
// drawing its arcs above the coverage band.
export const SV_CHANNELS_ON: SvChannelsWrite = {
  showPileup: false,
  groupBy: { type: 'pairOrientation' },
  readConnections: 'arc',
  drawProperPairArcs: false,
}

// Leaving the arrangement UNSETS what it can unset rather than asserting a
// state: `readConnections` goes back to inheriting, and the two plain booleans
// go back to their schema defaults, which is the closest thing they have.
//
// It is still not a restore — a tag grouping or a read cloud in place before
// the row was ticked does not come back, since nothing banks what it displaced.
export const SV_CHANNELS_OFF: SvChannelsWrite = {
  showPileup: true,
  groupBy: undefined,
  readConnections: undefined,
  drawProperPairArcs: true,
}

export function isSvChannelsActive(current: SvChannelsSettings) {
  return (
    current.showPileup === SV_CHANNELS_ON.showPileup &&
    current.groupBy?.type === SV_CHANNELS_ON.groupBy?.type &&
    current.readConnections === SV_CHANNELS_ON.readConnections &&
    current.drawProperPairArcs === SV_CHANNELS_ON.drawProperPairArcs
  )
}
