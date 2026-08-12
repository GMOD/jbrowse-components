/**
 * dockview's `dockview-theme-dark`, transcribed.
 *
 * We render the workspace ourselves now, but the look is deliberately not a new
 * design — it is the theme we already shipped, so nothing about the chrome
 * changed for users when the engine underneath it did. Every value below is
 * copied from `dockview/dist/styles/dockview.css`'s `.dockview-theme-dark`
 * block (v8.0.0); the names are its CSS custom properties with the `--dv-`
 * prefix dropped.
 *
 * **Fixed, not theme-derived.** These apply in a light JBrowse theme too, the
 * same way the app bar is dark in both — the chrome frames the content rather
 * than matching it. Don't wire them to `theme.palette`: a light strip reads as
 * content, which is exactly what it looked like before this file existed.
 *
 * Kept in one module because four components draw parts of the same chrome, and
 * the four-way tab colouring below is a rule about the whole, not about any one
 * of them.
 */
export const dv = {
  /** the panel body, behind and below whatever the tab holds */
  groupBackground: '#1e1e1e',
  /** the tab strip itself */
  tabsBackground: '#252526',

  // A tab's colours depend on TWO things: whether its panel is the active one,
  // and whether it is the tab that panel is showing. dockview enumerates all
  // four rather than dimming one axis, so the focused panel's selected tab is
  // the only fully-white label on screen.
  activeGroupVisibleTabBackground: '#1e1e1e',
  activeGroupHiddenTabBackground: '#2d2d2d',
  inactiveGroupVisibleTabBackground: '#1e1e1e',
  inactiveGroupHiddenTabBackground: '#2d2d2d',
  activeGroupVisibleTabColor: 'white',
  activeGroupHiddenTabColor: '#969696',
  inactiveGroupVisibleTabColor: '#8f8f8f',
  inactiveGroupHiddenTabColor: '#626262',

  tabDividerColor: '#1e1e1e',
  separatorBorder: 'rgb(68, 68, 68)',
  iconHoverBackground: 'rgba(90, 93, 94, 0.31)',
  dragOverBackground: 'rgba(83, 89, 93, 0.5)',
  edgeDockIndicatorColor: 'rgba(56, 139, 253, 0.9)',

  tabsHeight: 35,
  tabsFontSize: 13,
  /** the sash is 4px of grab area with a 1px line drawn inside it */
  sashSize: 4,
} as const

/** The background and text a tab takes, given where it sits. */
export function tabColors(groupActive: boolean, visible: boolean) {
  if (groupActive) {
    return visible
      ? {
          background: dv.activeGroupVisibleTabBackground,
          color: dv.activeGroupVisibleTabColor,
        }
      : {
          background: dv.activeGroupHiddenTabBackground,
          color: dv.activeGroupHiddenTabColor,
        }
  }
  return visible
    ? {
        background: dv.inactiveGroupVisibleTabBackground,
        color: dv.inactiveGroupVisibleTabColor,
      }
    : {
        background: dv.inactiveGroupHiddenTabBackground,
        color: dv.inactiveGroupHiddenTabColor,
      }
}
