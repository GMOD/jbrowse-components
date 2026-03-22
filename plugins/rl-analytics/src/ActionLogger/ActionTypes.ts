import type { IJsonPatch } from '@jbrowse/mobx-state-tree'

export enum ActionType {
  ZOOM_IN = 'ZOOM_IN',
  ZOOM_OUT = 'ZOOM_OUT',
  PAN_LEFT = 'PAN_LEFT',
  PAN_RIGHT = 'PAN_RIGHT',
  SEARCH = 'SEARCH',
  TOGGLE_TRACK = 'TOGGLE_TRACK',
  OPEN_WIDGET = 'OPEN_WIDGET',
  CLOSE_WIDGET = 'CLOSE_WIDGET',
  SELECT_FEATURE = 'SELECT_FEATURE',
  ADD_VIEW = 'ADD_VIEW',
  UNKNOWN = 'UNKNOWN',
}

export interface ClassifiedAction {
  type: ActionType
  timestamp: number
  patch: IJsonPatch
  reversePatch: IJsonPatch
  metadata: Record<string, unknown>
}

export interface ClassificationRule {
  pathPattern: RegExp
  op: string
  classify: (
    patch: IJsonPatch,
    reversePatch: IJsonPatch,
  ) => { type: ActionType; metadata: Record<string, unknown> }
}
