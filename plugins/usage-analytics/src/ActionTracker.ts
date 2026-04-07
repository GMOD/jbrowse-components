const ACTION_MAP: Record<string, string> = {
  // Navigation — zoom
  zoomTo: 'zoom',
  setNewView: 'zoom',
  moveTo: 'zoom',
  // Navigation — pan
  horizontalScroll: 'pan',
  scrollTo: 'pan',
  // Navigation — coordinate entry (locstring / parsed location)
  navTo: 'nav_coord',
  navToLocString: 'nav_coord',
  navToLocation: 'nav_coord',
  navToLocations: 'nav_coord',
  navToMultiple: 'nav_coord',
  // Navigation — text search (gene name, feature ID)
  navToSearchString: 'nav_search',
  // Track management
  showTrack: 'show_track',
  toggleTrack: 'show_track',
  hideTrack: 'hide_track',
  moveTrackUp: 'reorder_track',
  moveTrackDown: 'reorder_track',
  moveTrackToTop: 'reorder_track',
  moveTrackToBottom: 'reorder_track',
  moveTrack: 'reorder_track',
  // View management
  addView: 'add_view',
  removeView: 'remove_view',
  horizontallyFlip: 'flip_view',
  // Widgets / dialogs
  addWidget: 'open_widget',
  // Display config — specific subtypes kept distinct for analysis
  setColorScheme: 'config_color_scheme',
  setSortedBy: 'config_sort',
  setSortedByAtPosition: 'config_sort',
  setFeatureHeight: 'config_height',
  setShowCenterLine: 'config_view_option',
  setShowGridlines: 'config_view_option',
  setColorByCDS: 'config_view_option',
  setShowCytobands: 'config_view_option',
  setHideHeader: 'config_view_option',
  setHideHeaderOverview: 'config_view_option',
  setShowTrackOutlines: 'config_view_option',
  setDrawSingletons: 'config_view_option',
  setDrawProperPairs: 'config_view_option',
  setDrawInter: 'config_view_option',
  setDrawLongRange: 'config_view_option',
  setLineWidth: 'config_view_option',
  // Other
  addBookmark: 'bookmark',
  addToHighlights: 'bookmark',
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

type RecordDetail = {
  viewType?: string
  trackShowType?: string
  trackHideType?: string
  widgetType?: string
}

export default class ActionTracker {
  private counts = new Map<string, number>()
  private bigrams = new Map<string, number>()
  private viewTypes = new Map<string, number>()
  private trackShowTypes = new Map<string, number>()
  private trackHideTypes = new Map<string, number>()
  private widgetTypes = new Map<string, number>()
  private prev: string | null = null
  private sessionStart = Date.now()
  private endpointUrl: string

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl
  }

  private inc(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  record(mstActionName: string, detail?: RecordDetail) {
    const type = ACTION_MAP[mstActionName]
    if (!type) {
      return
    }
    this.inc(this.counts, type)
    if (this.prev) {
      this.inc(this.bigrams, `${this.prev}->${type}`)
    }
    this.prev = type

    if (detail?.viewType) this.inc(this.viewTypes, detail.viewType)
    if (detail?.trackShowType) this.inc(this.trackShowTypes, detail.trackShowType)
    if (detail?.trackHideType) this.inc(this.trackHideTypes, detail.trackHideType)
    if (detail?.widgetType) this.inc(this.widgetTypes, detail.widgetType)
  }

  flush(reason: 'visibility_hidden' | 'manual') {
    if (!this.endpointUrl || this.counts.size === 0) {
      return
    }
    const payload = JSON.stringify({
      feature_counts: Object.fromEntries(this.counts),
      transitions: Object.fromEntries(this.bigrams),
      view_types: Object.fromEntries(this.viewTypes),
      track_show_types: Object.fromEntries(this.trackShowTypes),
      track_hide_types: Object.fromEntries(this.trackHideTypes),
      widget_types: Object.fromEntries(this.widgetTypes),
      session_length_bucket: sessionLengthBucket(Date.now() - this.sessionStart),
      session_end_reason: reason,
    })
    navigator.sendBeacon(this.endpointUrl, payload)
  }

  dispose() {
    this.flush('visibility_hidden')
  }
}
