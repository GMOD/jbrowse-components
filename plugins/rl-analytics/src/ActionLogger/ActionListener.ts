import { addMiddleware } from '@jbrowse/mobx-state-tree'

import ActionBuffer from './ActionBuffer.ts'
import { ActionType, type ClassifiedAction } from './ActionTypes.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export type ActionCallback = (action: ClassifiedAction) => void

/**
 * Mapping from MST action names to semantic ActionTypes.
 */
const ACTION_MAP: Record<string, ActionType> = {
  // Navigation — zoom
  zoomTo: ActionType.ZOOM,
  setNewView: ActionType.ZOOM,
  moveTo: ActionType.ZOOM, // rubberband zoom — calls zoomTo + scrollTo internally

  // Navigation — pan
  horizontalScroll: ActionType.PAN,
  scrollTo: ActionType.PAN,

  // Navigation — search/jump
  navTo: ActionType.NAV_TO,
  navToLocString: ActionType.NAV_TO,
  navToSearchString: ActionType.NAV_TO,
  navToLocation: ActionType.NAV_TO,
  navToLocations: ActionType.NAV_TO,
  navToMultiple: ActionType.NAV_TO,

  // Track management
  showTrack: ActionType.SHOW_TRACK,
  toggleTrack: ActionType.SHOW_TRACK,
  hideTrack: ActionType.HIDE_TRACK,
  moveTrackUp: ActionType.REORDER_TRACK,
  moveTrackDown: ActionType.REORDER_TRACK,
  moveTrackToTop: ActionType.REORDER_TRACK,
  moveTrackToBottom: ActionType.REORDER_TRACK,
  moveTrack: ActionType.REORDER_TRACK,

  // View management
  addView: ActionType.ADD_VIEW,
  removeView: ActionType.REMOVE_VIEW,
  horizontallyFlip: ActionType.FLIP_VIEW,

  // View display config
  setShowCenterLine: ActionType.CONFIG_CHANGE,
  setShowGridlines: ActionType.CONFIG_CHANGE,
  setColorByCDS: ActionType.CONFIG_CHANGE,
  setShowCytobands: ActionType.CONFIG_CHANGE,
  setHideHeader: ActionType.CONFIG_CHANGE,
  setHideHeaderOverview: ActionType.CONFIG_CHANGE,
  setShowTrackOutlines: ActionType.CONFIG_CHANGE,

  // Track display config (alignments, wiggle, etc.)
  setColorScheme: ActionType.CONFIG_CHANGE,
  setSortedBy: ActionType.CONFIG_CHANGE,
  setSortedByAtPosition: ActionType.CONFIG_CHANGE,
  setFeatureHeight: ActionType.CONFIG_CHANGE,
  setDrawSingletons: ActionType.CONFIG_CHANGE,
  setDrawProperPairs: ActionType.CONFIG_CHANGE,
  setDrawInter: ActionType.CONFIG_CHANGE,
  setDrawLongRange: ActionType.CONFIG_CHANGE,
  setLineWidth: ActionType.CONFIG_CHANGE,

  // Export
  exportSvg: ActionType.CONFIG_CHANGE,

  // Widgets
  addWidget: ActionType.OPEN_WIDGET,

  // Bookmarks / highlights
  addBookmark: ActionType.BOOKMARK,
  addToHighlights: ActionType.BOOKMARK,
  removeHighlight: ActionType.BOOKMARK,

  // Undo / redo
  undo: ActionType.UNDO,
  redo: ActionType.UNDO,
}

/**
 * Listens to MST onAction on a session and classifies actions semantically.
 *
 * Only emits actions that are in ACTION_MAP (user-meaningful actions).
 * Internal/mechanical actions (scrollTo, setWidth, etc.) are ignored.
 * Sub-actions (scrollTo called by zoomTo) are filtered by only including
 * action names in ACTION_MAP — scrollTo is not in the map, so it's dropped.
 */
export default class ActionListener {
  buffer: ActionBuffer
  private disposer: (() => void) | null = null
  private callbacks: ActionCallback[] = []
  private logOther: boolean

  constructor(bufferSize = 10000, debounceMs = 500, logOther = false) {
    this.buffer = new ActionBuffer(bufferSize, debounceMs)
    this.logOther = logOther
  }

  attach(target: IAnyStateTreeNode) {
    // addMiddleware intercepts ALL actions in the entire MST tree,
    // including child nodes (views, tracks, etc.) — unlike onAction
    // which only fires for the target node itself.
    this.disposer = addMiddleware(target, (call, next) => {
      // Always let the action proceed first
      const result = next(call)

      // Only capture top-level actions (not sub-actions like scrollTo inside zoomTo)
      if (call.parentActionEvent) {
        return result
      }

      const actionType = ACTION_MAP[call.name]
      if (!actionType && !this.logOther) {
        return result
      }

      const classified: ClassifiedAction = {
        type: actionType ?? ActionType.OTHER,
        timestamp: Date.now(),
        sourceAction: call.name,
        path: '',
        metadata: this.extractMetadata(call.name, call.args ?? [], call.tree),
      }

      this.buffer.push(classified)
      for (const cb of this.callbacks) {
        try {
          cb(classified)
        } catch {
          // don't break the listener
        }
      }

      return result
    })
  }

  /** Resolve an MST instance ID to a config trackId using the view's track list */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveTrackId(instanceId: string, tree: any): string {
    try {
      // tree might be the view directly, or we may need to search views
      const views = tree?.views ?? (tree?.tracks ? [tree] : [])
      for (const view of views) {
        const tracks = view?.tracks ?? []
        for (const t of tracks) {
          if (t.id === instanceId) {
            // configuration might be a reference (string) or an object with trackId
            const config = t.configuration
            if (typeof config === 'string') {
              return config
            }
            if (config?.trackId) {
              return String(config.trackId)
            }
          }
        }
      }
      return instanceId
    } catch {
      return instanceId
    }
  }

  private extractMetadata(
    name: string,
    args: unknown[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tree?: any,
  ): Record<string, unknown> {
    const meta: Record<string, unknown> = {}

    switch (name) {
      case 'zoomTo':
        meta.bpPerPx = args[0]
        break
      case 'setNewView':
        meta.bpPerPx = args[0]
        meta.offsetPx = args[1]
        break
      case 'horizontalScroll':
        meta.distance = args[0]
        break
      case 'scrollTo':
        meta.offsetPx = args[0]
        break
      case 'moveTo':
        // args are BpOffset objects: {refName, index, offset}
        meta.startOffset = args[0]
        meta.endOffset = args[1]
        break
      case 'navTo':
        meta.target = args[0]
        break
      case 'navToLocString':
        // args[0] is the raw location string (e.g., "ctgA:1000-2000")
        meta.searchText = args[0]
        break
      case 'navToSearchString':
        // args[0] is {input, assembly} — input is the raw search text
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta.searchText = (args[0] as any)?.input ?? args[0]
        break
      case 'showTrack':
      case 'toggleTrack':
        meta.trackId = args[0]
        break
      case 'hideTrack':
        meta.trackId = args[0]
        break
      case 'moveTrackUp':
      case 'moveTrackDown':
        meta.trackId = args[0]
        meta.direction = name === 'moveTrackUp' ? 'up' : 'down'
        break
      case 'addBookmark':
      case 'addToHighlights':
        meta.highlight = args[0]
        break
      case 'moveTrack':
        meta.movingId = args[0]
        meta.targetId = args[1]
        break
      case 'moveTrackToTop':
      case 'moveTrackToBottom':
        meta.trackId = args[0]
        meta.direction = name === 'moveTrackToTop' ? 'top' : 'bottom'
        break
      case 'undo':
      case 'redo':
        meta.operation = name
        break
      case 'setColorScheme':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta.colorBy = (args[0] as any)?.type ?? args[0]
        break
      case 'setSortedBy':
      case 'setSortedByAtPosition':
        meta.sortBy = args[0]
        break
      case 'setFeatureHeight':
        meta.height = args[0]
        break
      case 'exportSvg':
        meta.operation = 'exportSvg'
        break
      case 'addView':
        meta.viewType = args[0]
        break
      case 'addWidget':
        meta.widgetType = args[0]
        break
      default:
        if (args.length > 0) {
          meta.args = args
        }
    }

    return meta
  }

  onAction(callback: ActionCallback) {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx >= 0) {
        this.callbacks.splice(idx, 1)
      }
    }
  }

  dispose() {
    this.disposer?.()
    this.disposer = null
    this.buffer.dispose()
    this.callbacks = []
  }
}
