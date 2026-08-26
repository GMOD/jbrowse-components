// The SV-channel arrangement, kept in a leaf module with no UI imports so it can
// be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's arrangement by its menu label. Same reason
// compactnessPresets.ts is its own module.

import type { ColorBy, GroupBy } from '../../shared/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'

export interface SvChannelsSettings {
  showPileup: boolean
  groupBy: GroupBy | undefined
  colorBy: ColorBy
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  drawProperPairArcs: boolean
}

export const SV_CHANNELS_LABEL = 'SV channels (pairs by orientation)'

// One band per pair orientation, each with its own coverage and its own arcs,
// concordant pairs left out. Every setting is reachable from the other menus;
// the preset exists because six of them spread across four menus is not an
// arrangement anyone finds by looking.
//
// The read-fill scheme is `pairOrientation`; `orientation` is the ARC
// vocabulary's name for the same idea (arcColorOptions.ts) and is not a
// registered ColorSchemeType. Writing it here would be caught by tsc, but the
// same mix-up in a config.json is only caught by the `colorBy` slot's validate
// hook, which drops the value and leaves the reads filled `normal`.
export const SV_CHANNELS_ON: SvChannelsSettings = {
  showPileup: false,
  groupBy: { type: 'pairOrientation' },
  colorBy: { type: 'pairOrientation' },
  readConnections: 'arc',
  readConnectionsDown: true,
  drawProperPairArcs: false,
}

export const SV_CHANNELS_OFF: SvChannelsSettings = {
  showPileup: true,
  groupBy: undefined,
  colorBy: { type: 'normal' },
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
    current.colorBy.type === SV_CHANNELS_ON.colorBy.type &&
    current.readConnections === SV_CHANNELS_ON.readConnections &&
    current.drawProperPairArcs === SV_CHANNELS_ON.drawProperPairArcs
  )
}
