export enum ActionType {
  // Navigation
  ZOOM = 'ZOOM',
  PAN = 'PAN',
  NAV_TO = 'NAV_TO',

  // Track management
  SHOW_TRACK = 'SHOW_TRACK',
  HIDE_TRACK = 'HIDE_TRACK',
  REORDER_TRACK = 'REORDER_TRACK',

  // View management
  ADD_VIEW = 'ADD_VIEW',
  REMOVE_VIEW = 'REMOVE_VIEW',
  FLIP_VIEW = 'FLIP_VIEW',

  // Display config
  CONFIG_CHANGE = 'CONFIG_CHANGE',

  // Widgets
  OPEN_WIDGET = 'OPEN_WIDGET',

  // Bookmarks / highlights
  BOOKMARK = 'BOOKMARK',

  // Undo / redo
  UNDO = 'UNDO',

  // Other
  OTHER = 'OTHER',
}

export interface ClassifiedAction {
  type: ActionType
  timestamp: number
  /** The MST action name that produced this (e.g. 'zoomTo', 'horizontalScroll') */
  sourceAction: string
  /** Action-specific data extracted from args */
  metadata: Record<string, unknown>
}
