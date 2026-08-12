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
 * **This is the chrome only, and the panel BODY is not chrome.** dockview also
 * has a `--dv-group-view-background-color` (`#1e1e1e`) for the surface a tab's
 * content sits on, and transcribing it is what made a light JBrowse theme come
 * up dark below the views — the frame swallowing the thing it frames. The body
 * follows `theme.palette.background.default` in `PanelView` instead, so the
 * cell matches every other surface the app draws content on. It is deliberately
 * absent here rather than present and unused, since an unused colour named
 * after the panel reads as a value someone forgot to wire up.
 *
 * A consequence worth knowing before "fixing" it: dockview's selected tab is
 * `#1e1e1e` **because** the body was, so the tab merged into its content. Ours
 * cannot merge into a light body, and the four values below are kept anyway —
 * darker-than-the-strip still reads as selected, and it is the one cue that
 * survives being the only dark band on screen.
 *
 * Kept in one module because four components draw parts of the same chrome, and
 * the four-way tab colouring below is a rule about the whole, not about any one
 * of them.
 */
export const dv = {
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
