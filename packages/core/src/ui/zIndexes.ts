// Stacking order, kept in one place so it is stated rather than inferred from
// magic numbers spread across displays. Two groups, and the split matters.
//
// The first is Material UI's own scale, reproduced here rather than read off
// `theme.zIndex`. `makeStyles` is handed JBrowse's plain-data style theme
// (`styleTheme.ts`), which carries no `zIndex` — a layer belongs where the
// layering is decided, not in a token bag every styled component drags around.
// See `agent-docs/reference/EAGER_BUNDLE.md`.

/** Material UI's `zIndex.drawer`: above the app bar (1100), below a modal (1300). */
export const DRAWER_Z_INDEX = 1200

/**
 * Material UI's `zIndex.tooltip`, for chrome that must clear every Material
 * surface without leaving that scale — the coordinate guide label, which is
 * fixed-position and follows the cursor across the whole app.
 */
export const MUI_TOOLTIP_Z_INDEX = 1500

// The second group is the two floating layers that live above everything else.
// Both sit far above Material UI's scale, so they are not expressible on it.

/**
 * Hover tooltips (see BaseTooltip). Above the app chrome so a tooltip near a
 * track edge isn't clipped by the drawer or the view's own overlays.
 */
export const TOOLTIP_Z_INDEX = 100000

/**
 * Right-click menus (see ContextMenu). One above the tooltip: the menu is
 * something the user just asked for, so nothing may cover it. Handlers still
 * drop the hover when opening a menu — this is what keeps a tooltip that
 * outlives that clear (a neighbouring display's, say) from landing on top.
 */
export const CONTEXT_MENU_Z_INDEX = TOOLTIP_Z_INDEX + 1
