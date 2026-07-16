import type { ComponentType } from 'react'

import { observer } from 'mobx-react'

import AlignmentConnections from './AlignmentConnections.tsx'
import Breakends from './Breakends.tsx'
import PairedFeatures from './PairedFeatures.tsx'
import Translocations from './Translocations.tsx'

import type { OverlayProps } from './overlayUtils.tsx'
import type { OverlayKind } from '../types.ts'

// `satisfies` is the point: a new OverlayKind with no overlay to draw it is a
// compile error here, not a match that classifies fine and renders nothing.
const overlayForKind = {
  alignment: AlignmentConnections,
  translocation: Translocations,
  paired: PairedFeatures,
  breakend: Breakends,
} satisfies Record<OverlayKind, ComponentType<OverlayProps>>

const Overlay = observer(function Overlay(props: OverlayProps) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)
  // Covers every kind, including the variant displays that keep no layout and so
  // can't be caught by `layoutUnknown`.
  const tooLarge = tracks.some(t => t.displays[0]?.regionTooLarge)
  const kind = model.overlayMatches.get(trackId)?.kind
  const OverlayForKind = tooLarge || !kind ? undefined : overlayForKind[kind]
  return OverlayForKind ? <OverlayForKind {...props} /> : null
})

export default Overlay
