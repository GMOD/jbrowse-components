# Action Vocabulary

This document is auto-generated from `src/ActionLogger/ActionListener.ts`.
Do not edit manually. Regenerate with:

    node scripts/generate_action_doc.mjs

The plugin classifies each captured MST action into a semantic
`ActionType`. Sub-actions (actions called internally by another action,
e.g. `scrollTo` inside `zoomTo`) are filtered out via MST's
`parentActionEvent` — only top-level user-initiated actions are recorded.

## Action types

### `ADD_VIEW`

| MST action | Captured metadata |
|------------|------------------|
| `addView` | — |

### `BOOKMARK`

| MST action | Captured metadata |
|------------|------------------|
| `addBookmark` | — |
| `addToHighlights` | `highlight` |
| `removeHighlight` | — |

### `CONFIG_CHANGE`

| MST action | Captured metadata |
|------------|------------------|
| `setShowCenterLine` | — |
| `setShowGridlines` | — |
| `setColorByCDS` | — |
| `setShowCytobands` | — |
| `setHideHeader` | — |
| `setHideHeaderOverview` | — |
| `setShowTrackOutlines` | — |
| `setColorScheme` | — |
| `setSortedBy` | — |
| `setSortedByAtPosition` | — |
| `setFeatureHeight` | — |
| `setDrawSingletons` | — |
| `setDrawProperPairs` | — |
| `setDrawInter` | — |
| `setDrawLongRange` | — |
| `setLineWidth` | — |
| `exportSvg` | — |

### `FLIP_VIEW`

| MST action | Captured metadata |
|------------|------------------|
| `horizontallyFlip` | — |

### `HIDE_TRACK`

| MST action | Captured metadata |
|------------|------------------|
| `hideTrack` | `trackId` |

### `NAV_TO`

| MST action | Captured metadata |
|------------|------------------|
| `navTo` | `target` |
| `navToLocString` | `searchText`, `target` |
| `navToSearchString` | — |
| `navToLocation` | — |
| `navToLocations` | — |
| `navToMultiple` | — |

### `OPEN_WIDGET`

| MST action | Captured metadata |
|------------|------------------|
| `addWidget` | — |

### `PAN`

| MST action | Captured metadata |
|------------|------------------|
| `horizontalScroll` | `distance` |
| `scrollTo` | `offsetPx` |

### `REMOVE_VIEW`

| MST action | Captured metadata |
|------------|------------------|
| `removeView` | — |

### `REORDER_TRACK`

| MST action | Captured metadata |
|------------|------------------|
| `moveTrackUp` | — |
| `moveTrackDown` | `trackId`, `direction` |
| `moveTrackToTop` | — |
| `moveTrackToBottom` | `trackId`, `direction` |
| `moveTrack` | `movingId`, `targetId` |

### `SHOW_TRACK`

| MST action | Captured metadata |
|------------|------------------|
| `showTrack` | — |
| `toggleTrack` | `trackId` |

### `UNDO`

| MST action | Captured metadata |
|------------|------------------|
| `undo` | — |
| `redo` | `operation` |

### `ZOOM`

| MST action | Captured metadata |
|------------|------------------|
| `zoomTo` | `bpPerPx` |
| `setNewView` | `bpPerPx`, `offsetPx` |
| `moveTo` | — |

## Summary

- **13** semantic action types
- **45** MST action names mapped
- **13** actions with custom metadata extraction

## Adding a new action

1. Add the semantic type (if new) to `ActionType` enum in
   `src/ActionLogger/ActionTypes.ts`.
2. Add an entry to `ACTION_MAP` in `src/ActionLogger/ActionListener.ts`
   mapping the MST action name to the semantic type.
3. If the action has arguments worth capturing, add a `case` to
   `extractMetadata()` in the same file.
4. Regenerate this doc: `node scripts/generate_action_doc.mjs`.
