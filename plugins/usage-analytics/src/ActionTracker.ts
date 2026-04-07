const ACTION_MAP: Record<string, string> = {
  zoomTo: 'zoom',
  setNewView: 'zoom',
  moveTo: 'zoom',
  horizontalScroll: 'pan',
  scrollTo: 'pan',
  navTo: 'nav_to',
  navToLocString: 'nav_to',
  navToSearchString: 'nav_to',
  navToLocation: 'nav_to',
  navToLocations: 'nav_to',
  navToMultiple: 'nav_to',
  showTrack: 'show_track',
  toggleTrack: 'show_track',
  hideTrack: 'hide_track',
  moveTrackUp: 'reorder_track',
  moveTrackDown: 'reorder_track',
  moveTrackToTop: 'reorder_track',
  moveTrackToBottom: 'reorder_track',
  moveTrack: 'reorder_track',
  addView: 'add_view',
  removeView: 'remove_view',
  horizontallyFlip: 'flip_view',
  addBookmark: 'bookmark',
  addToHighlights: 'bookmark',
  addWidget: 'open_widget',
  undo: 'undo',
  redo: 'redo',
  exportSvg: 'export_svg',
}

function sessionLengthBucket(ms: number): string {
  if (ms < 60_000) return '<1min'
  if (ms < 300_000) return '1-5min'
  if (ms < 900_000) return '5-15min'
  if (ms < 1_800_000) return '15-30min'
  return '30min+'
}

export default class ActionTracker {
  private counts = new Map<string, number>()
  private bigrams = new Map<string, number>()
  private viewTypes = new Map<string, number>()
  private trackTypes = new Map<string, number>()
  private prev: string | null = null
  private sessionStart = Date.now()
  private endpointUrl: string

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl
  }

  record(mstActionName: string, detail?: { viewType?: string; trackType?: string }) {
    const type = ACTION_MAP[mstActionName]
    if (!type) {
      return
    }
    this.counts.set(type, (this.counts.get(type) ?? 0) + 1)
    if (this.prev) {
      const key = `${this.prev}->${type}`
      this.bigrams.set(key, (this.bigrams.get(key) ?? 0) + 1)
    }
    this.prev = type

    if (detail?.viewType) {
      this.viewTypes.set(detail.viewType, (this.viewTypes.get(detail.viewType) ?? 0) + 1)
    }
    if (detail?.trackType) {
      this.trackTypes.set(detail.trackType, (this.trackTypes.get(detail.trackType) ?? 0) + 1)
    }
  }

  flush(reason: 'visibility_hidden' | 'manual') {
    if (!this.endpointUrl || this.counts.size === 0) {
      return
    }
    const payload = JSON.stringify({
      feature_counts: Object.fromEntries(this.counts),
      transitions: Object.fromEntries(this.bigrams),
      view_types: Object.fromEntries(this.viewTypes),
      track_types: Object.fromEntries(this.trackTypes),
      session_length_bucket: sessionLengthBucket(Date.now() - this.sessionStart),
      session_end_reason: reason,
    })
    navigator.sendBeacon(this.endpointUrl, payload)
  }

  dispose() {
    this.flush('visibility_hidden')
  }
}
