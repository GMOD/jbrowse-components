// The two floating layers that live above everything else, kept in one place so
// their relative order is stated rather than inferred from magic numbers spread
// across displays. Both sit far above Material UI's own scale (modal 1300), so
// they are not expressible as `theme.zIndex` entries.

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
