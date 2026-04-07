const ACTION_MAP: Record<string, string> = {
  // Navigation — zoom
  zoomTo: 'zoom',
  setNewView: 'zoom',
  moveTo: 'zoom',
  // Navigation — pan
  horizontalScroll: 'pan',
  scrollTo: 'pan',
  // Navigation — coordinate entry
  navTo: 'nav_coord',
  navToLocString: 'nav_coord',
  navToLocation: 'nav_coord',
  navToLocations: 'nav_coord',
  navToMultiple: 'nav_coord',
  // Navigation — text search (gene name, feature ID)
  navToSearchString: 'nav_search',
  // Navigation — search returned multiple results (fired as sub-action of nav_search)
  setSearchResults: 'search_disambiguation_shown',
  // Navigation — jump to feature from feature detail panel
  navToFeature: 'nav_to_feature',
  // Navigation — show all regions
  showAllRegions: 'show_all_regions',
  showAllRegionsInAssembly: 'show_all_regions_assembly',
  // Track management
  showTrack: 'show_track',
  toggleTrack: 'show_track',
  hideTrack: 'hide_track',
  moveTrackUp: 'reorder_track',
  moveTrackDown: 'reorder_track',
  moveTrackToTop: 'reorder_track',
  moveTrackToBottom: 'reorder_track',
  moveTrack: 'reorder_track',
  addTrackConf: 'track_added',
  deleteTrackConf: 'track_deleted',
  // View management
  addView: 'add_view',
  removeView: 'remove_view',
  horizontallyFlip: 'flip_view',
  moveViewUp: 'reorder_view',
  moveViewDown: 'reorder_view',
  moveViewToTop: 'reorder_view',
  moveViewToBottom: 'reorder_view',
  clearView: 'clear_view',
  // Feature interaction
  selectFeature: 'feature_selected',
  // Track selector
  activateTrackSelector: 'track_selector_opened',
  // Widgets / dialogs
  addWidget: 'open_widget',
  showWidgetDrawer: 'drawer_shown',
  minimizeWidgetDrawer: 'drawer_minimized',
  hideAllWidgets: 'hide_all_widgets',
  editConfiguration: 'open_config_editor',
  queueDialog: 'open_dialog',
  // Connections
  makeConnection: 'connection_added',
  breakConnection: 'connection_removed',
  // App config
  setThemeName: 'config_theme',
  setDrawerPosition: 'config_drawer_position',
  setStickyViewHeaders: 'config_sticky_headers',
  setUseWorkspaces: 'config_workspaces',
  // View display config (each kept distinct for analysis)
  setTrackLabels: 'config_track_labels',
  setShowCenterLine: 'config_center_line',
  setShowGridlines: 'config_gridlines',
  setColorByCDS: 'config_color_by_cds',
  setShowCytobands: 'config_cytobands',
  setHideHeader: 'config_hide_header',
  setHideHeaderOverview: 'config_hide_header_overview',
  setShowTrackOutlines: 'config_track_outlines',
  setShowLegend: 'config_legend',
  setShowTooltips: 'config_tooltips',
  // Track display config — common
  setColorScheme: 'config_color_scheme',
  setSortedBy: 'config_sort',
  setSortedByAtPosition: 'config_sort',
  setFeatureHeight: 'config_height',
  setRowHeight: 'config_row_height',
  setLineWidth: 'config_line_width',
  // Track display config — alignments
  setDrawSingletons: 'config_singletons',
  setDrawProperPairs: 'config_proper_pairs',
  setDrawInter: 'config_inter_chr_reads',
  setDrawLongRange: 'config_long_range_reads',
  setLowerPanelType: 'config_alignment_panel',
  toggleSoftClipping: 'config_soft_clipping',
  toggleMismatchAlpha: 'config_mismatch_alpha',
  setFilterBy: 'config_alignment_filter',
  setJexlFilters: 'config_jexl_filter',
  setHideSmallIndels: 'config_hide_small_indels',
  setHideMismatches: 'config_hide_mismatches',
  setHideLargeIndels: 'config_hide_large_indels',
  // Track display config — variants / LD
  setMafFilter: 'config_maf_filter',
  setHweFilter: 'config_hwe_filter',
  setCallRateFilter: 'config_call_rate_filter',
  setLengthCutoffFilter: 'config_length_cutoff_filter',
  setLDMetric: 'config_ld_metric',
  setSignedLD: 'config_signed_ld',
  setShowTree: 'config_cluster_tree',
  setPhasedMode: 'config_phased_mode',
  setUseGenomicPositions: 'config_genomic_positions',
  setFitToHeight: 'config_fit_to_height',
  setShowRecombination: 'config_show_recombination',
  setShowLDTriangle: 'config_show_ld_triangle',
  // Other
  addBookmark: 'bookmark',
  addToHighlights: 'bookmark',
  removeHighlight: 'bookmark_removed',
  undo: 'undo',
  redo: 'redo',
  exportSvg: 'export_svg',
  notifyError: 'error_encountered',
}

// Actions that are normally sub-actions but we still want to capture
const SUB_ACTION_EXCEPTIONS = new Set(['setSearchResults', 'addBookmark', 'addToHighlights'])

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
  dialogType?: string
}

export { SUB_ACTION_EXCEPTIONS }

export default class ActionTracker {
  private counts = new Map<string, number>()
  private bigrams = new Map<string, number>()
  private viewTypes = new Map<string, number>()
  private trackShowTypes = new Map<string, number>()
  private trackHideTypes = new Map<string, number>()
  private widgetTypes = new Map<string, number>()
  private dialogTypes = new Map<string, number>()
  private menuClicks = new Map<string, number>()
  private uiEvents = new Map<string, number>()
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
    if (detail?.dialogType) this.inc(this.dialogTypes, detail.dialogType)
  }

  recordUIEvent(type: string, label?: string) {
    if (type === 'menu_item_click' && label) {
      this.inc(this.menuClicks, label)
    } else {
      this.inc(this.uiEvents, label ? `${type}:${label}` : type)
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
      track_show_types: Object.fromEntries(this.trackShowTypes),
      track_hide_types: Object.fromEntries(this.trackHideTypes),
      widget_types: Object.fromEntries(this.widgetTypes),
      dialog_types: Object.fromEntries(this.dialogTypes),
      menu_clicks: Object.fromEntries(this.menuClicks),
      ui_events: Object.fromEntries(this.uiEvents),
      session_length_bucket: sessionLengthBucket(Date.now() - this.sessionStart),
      session_end_reason: reason,
    })
    navigator.sendBeacon(this.endpointUrl, payload)
  }

  dispose() {
    this.flush('visibility_hidden')
  }
}
