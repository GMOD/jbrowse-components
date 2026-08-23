/**
 * The tooltip on each comparative view's settings button (the sliders icon),
 * keyed by view type. The two menus are the same widget with the same rows, and
 * only the button a reader looks for is named per view.
 *
 * Here rather than beside each menu because the website's figure recipes name
 * this label in a click path, and the node script that builds them cannot load
 * a module importing React or MUI — which both menus do. A leaf module is what
 * lets the recipe import the label instead of retyping it.
 */
export const SETTINGS_SURFACE_LABELS = {
  LinearSyntenyView: 'Synteny display settings',
  DotplotView: 'Dotplot display settings',
} as const
