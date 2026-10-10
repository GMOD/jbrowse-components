import { connectorMark, defineMark } from '@jbrowse/render-core/marks'
import { HIDDEN_SEGMENT_DASH } from '@jbrowse/sv-core'

import { connectorArrowPx } from '../../features/linkedReads/connectorFeed.ts'

import type { ConnectorFeed } from '../../features/linkedReads/connectorFeed.ts'
import type { RenderState, SectionRender } from './rendererTypes.ts'
import type { ConnectorParams, Mark } from '@jbrowse/render-core/marks'

const DASH = HIDDEN_SEGMENT_DASH.split(' ').map(Number) as [number, number]

/** A section's render state with where its connectors stand and clip. */
export interface ConnectorBandState extends RenderState {
  connector: ConnectorParams
}

/** The section's connector placement: row centres on its pileup band, scrolled. */
export function connectorParamsOf(
  state: RenderState,
  sec: SectionRender,
): ConnectorParams {
  return {
    regions: state.linkRegions,
    rowOffsetPx:
      sec.pileupTopOffset - state.scrollTop + state.featureHeight / 2,
    rowPitchPx: state.featureHeight + state.featureSpacing,
    arrowPx: connectorArrowPx(state.featureHeight),
    strokeDash: DASH,
  }
}

/**
 * The read-pair and split-read connectors the straight-line pass leaves:
 * curves, cross-region lines, dashed junctions across unfetched segments and
 * maps-back loops. One mark over the whole canvas from every region's feed,
 * so a connector crosses a region seam whole.
 */
export const CONNECTOR_MARK: Mark<ConnectorFeed, ConnectorBandState> =
  defineMark({
    shape: connectorMark,
    channels: (f: ConnectorFeed) => f.channels,
    params: (s: ConnectorBandState) => s.connector,
  })

export const EMPTY_CONNECTOR_FEED: ConnectorFeed = {
  channels: {
    x: new Uint32Array(0),
    x2: new Uint32Array(0),
    x2Region: new Uint32Array(0),
    row: new Uint32Array(0),
    row2: new Uint32Array(0),
    bend: new Float32Array(0),
    width: new Float32Array(0),
    color: new Uint32Array(0),
    bits: new Uint8Array(0),
    count: 0,
  },
  hits: [],
}
