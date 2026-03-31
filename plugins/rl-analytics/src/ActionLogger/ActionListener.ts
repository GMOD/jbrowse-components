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
  hideTrack: ActionType.HIDE_TRACK,

  // View management
  addView: ActionType.ADD_VIEW,
  removeView: ActionType.REMOVE_VIEW,
  horizontallyFlip: ActionType.FLIP_VIEW,

  // Display config
  setShowCenterLine: ActionType.CONFIG_CHANGE,
  setShowGridlines: ActionType.CONFIG_CHANGE,
  setColorByCDS: ActionType.CONFIG_CHANGE,
  setShowCytobands: ActionType.CONFIG_CHANGE,
  setHideHeader: ActionType.CONFIG_CHANGE,
  setHideHeaderOverview: ActionType.CONFIG_CHANGE,
  setShowTrackOutlines: ActionType.CONFIG_CHANGE,

  // Widgets
  addWidget: ActionType.OPEN_WIDGET,
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
        metadata: this.extractMetadata(call.name, call.args ?? []),
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

  private extractMetadata(
    name: string,
    args: unknown[],
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
        meta.start = args[0]
        meta.end = args[1]
        break
      case 'navTo':
      case 'navToLocString':
      case 'navToSearchString':
        meta.target = args[0]
        break
      case 'showTrack':
        meta.trackId = args[0]
        break
      case 'hideTrack':
        meta.trackId = args[0]
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
