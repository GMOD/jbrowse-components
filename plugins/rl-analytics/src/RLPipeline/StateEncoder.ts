import type { BrowserState, TrackInfo } from './types.ts'

function classifyZoomLevel(
  bpPerPx: number,
): BrowserState['zoomLevel'] {
  if (bpPerPx > 100) {
    return 'genome'
  }
  if (bpPerPx > 10) {
    return 'region'
  }
  if (bpPerPx > 1) {
    return 'gene'
  }
  if (bpPerPx > 0.1) {
    return 'sequence'
  }
  return 'basepair'
}

const TRACK_TYPE_CATEGORIES: Record<string, keyof Pick<
  BrowserState,
  'hasGeneTrack' | 'hasAlignmentTrack' | 'hasVariantTrack' | 'hasQuantitativeTrack'
>> = {
  FeatureTrack: 'hasGeneTrack',
  AlignmentsTrack: 'hasAlignmentTrack',
  VariantTrack: 'hasVariantTrack',
  QuantitativeTrack: 'hasQuantitativeTrack',
  ReferenceSequenceTrack: 'hasGeneTrack', // also counts
}

export default class StateEncoder {
  private sessionStartTime = Date.now()
  private refNamesVisited = new Set<string>()
  private actionCounts: Record<string, number> = {}
  private totalActions = 0

  extractState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    view: any,
    lastActionTimestamp: number,
    recentActionCount: number,
  ): BrowserState {
    let bpPerPx = 1
    let offsetPx = 0
    let viewWidthPx = 800
    try {
      bpPerPx = view.bpPerPx ?? 1
      offsetPx = view.offsetPx ?? 0
      viewWidthPx = view.width ?? 800
    } catch {
      // computed properties may throw if view not rendered
    }

    const viewportBp = bpPerPx * viewWidthPx
    const displayedRegions = view.displayedRegions ?? []
    const firstRegion = displayedRegions[0] ?? {
      assemblyName: '',
      refName: '',
      start: 0,
      end: 0,
    }

    const refName = firstRegion.refName || ''
    if (refName) {
      this.refNamesVisited.add(refName)
    }

    // Extract track info
    const tracks = view.tracks ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeTracks: TrackInfo[] = tracks.map((t: any) => {
      const trackId = t.configuration?.trackId ?? ''
      const trackType = t.type ?? ''
      const displays = t.displays ?? []
      const displayType = displays[0]?.type ?? ''
      return { trackId, trackType, displayType }
    })

    // Categorize tracks
    let hasReferenceSequence = false
    let hasGeneTrack = false
    let hasAlignmentTrack = false
    let hasVariantTrack = false
    let hasQuantitativeTrack = false

    for (const track of activeTracks) {
      if (track.trackType === 'ReferenceSequenceTrack') {
        hasReferenceSequence = true
      }
      const cat = TRACK_TYPE_CATEGORIES[track.trackType]
      if (cat === 'hasGeneTrack') {
        hasGeneTrack = true
      }
      if (cat === 'hasAlignmentTrack') {
        hasAlignmentTrack = true
      }
      if (cat === 'hasVariantTrack') {
        hasVariantTrack = true
      }
      if (cat === 'hasQuantitativeTrack') {
        hasQuantitativeTrack = true
      }
    }

    // Content blocks
    let visibleContentBlocks = 0
    try {
      visibleContentBlocks =
        view.dynamicBlocks?.contentBlocks?.length ?? 0
    } catch {
      // may throw
    }

    return {
      bpPerPx,
      offsetPx,
      viewWidthPx,
      assemblyName: firstRegion.assemblyName,
      refName,
      startBp: firstRegion.start,
      endBp: firstRegion.end,
      viewportBp,
      zoomLevel: classifyZoomLevel(bpPerPx),
      activeTracks,
      numTracks: activeTracks.length,
      visibleContentBlocks,
      hasReferenceSequence,
      hasGeneTrack,
      hasAlignmentTrack,
      hasVariantTrack,
      hasQuantitativeTrack,
      timeSinceLastAction:
        lastActionTimestamp > 0 ? Date.now() - lastActionTimestamp : 0,
      actionsInLast5Seconds: recentActionCount,
      sessionDurationMs: Date.now() - this.sessionStartTime,
      actionCountsByType: { ...this.actionCounts },
      uniqueRefNamesVisited: [...this.refNamesVisited],
      totalActionsThisSession: this.totalActions,
    }
  }

  recordAction(actionType: string) {
    this.actionCounts[actionType] =
      (this.actionCounts[actionType] ?? 0) + 1
    this.totalActions++
  }

  /** Numeric vector for RL training */
  encode(state: BrowserState): number[] {
    return [
      Math.log(state.bpPerPx),
      state.offsetPx / 1000,
      state.viewWidthPx / 1000,
      state.viewportBp / 1e6,
      state.numTracks / 10,
      // Zoom level as ordinal (0-4)
      ['genome', 'region', 'gene', 'sequence', 'basepair'].indexOf(
        state.zoomLevel,
      ) / 4,
      // Track type booleans
      state.hasReferenceSequence ? 1 : 0,
      state.hasGeneTrack ? 1 : 0,
      state.hasAlignmentTrack ? 1 : 0,
      state.hasVariantTrack ? 1 : 0,
      state.hasQuantitativeTrack ? 1 : 0,
      // Temporal
      Math.log1p(state.timeSinceLastAction),
      state.actionsInLast5Seconds / 10,
      Math.log1p(state.sessionDurationMs / 1000),
      state.totalActionsThisSession / 100,
      // Spatial diversity
      state.uniqueRefNamesVisited.length / 10,
      state.visibleContentBlocks / 10,
    ]
  }

  get dimensions(): number {
    return 17
  }
}
