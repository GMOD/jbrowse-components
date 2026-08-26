// The SV-channel arrangement, kept in a leaf module with no UI imports so it can
// be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's arrangement by its menu label. Same reason
// compactnessPresets.ts is its own module.

import type { GroupBy } from '../../shared/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'

export interface SvChannelsSettings {
  showPileup: boolean
  groupBy: GroupBy | undefined
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  drawProperPairArcs: boolean
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
export const SV_CHANNELS_ON: SvChannelsSettings = {
  showPileup: false,
  groupBy: { type: 'pairOrientation' },
  readConnections: 'arc',
  readConnectionsDown: true,
  drawProperPairArcs: false,
}

export const SV_CHANNELS_OFF: SvChannelsSettings = {
  showPileup: true,
  groupBy: undefined,
  readConnections: 'off',
  readConnectionsDown: false,
  drawProperPairArcs: true,
}

// `readConnectionsDown` is left out of the match: which side of the coverage the
// arcs hang on is a framing choice, and flipping it should not read as having
// left the arrangement.
export function isSvChannelsActive(current: SvChannelsSettings) {
  return (
    current.showPileup === SV_CHANNELS_ON.showPileup &&
    current.groupBy?.type === SV_CHANNELS_ON.groupBy?.type &&
    current.readConnections === SV_CHANNELS_ON.readConnections &&
    current.drawProperPairArcs === SV_CHANNELS_ON.drawProperPairArcs
  )
}
