// What every surface calls scroll-to-zoom, in a module with no React in it:
// LinearGenomeView's `menuItems.ts` is evaluated eagerly and must not pull a
// Material component graph in behind a pair of strings (see
// agent-docs/reference/EAGER_BUNDLE.md). The control that renders them is
// ScrollZoomToggle.

/**
 * The preference's name. One string, because it had four spellings across three
 * headers and a menu, and a user who meets it twice has to recognize it as the
 * same thing.
 */
export const SCROLL_ZOOM_LABEL = 'Zoom on scroll'

/**
 * The header control's hover text. The checkbox already says what it is, so
 * this only says what the wheel does; the caveats live in SCROLL_ZOOM_HELP.
 */
export const SCROLL_ZOOM_TIP =
  'The mouse wheel zooms instead of scrolling the page'

/**
 * The Preferences dialog's help text. It names where the page still scrolls,
 * which is the part users cannot guess: with this on, the wheel over a track is
 * the view's, and no modifier takes it back — the browser turns shift+wheel into
 * horizontal scroll, ctrl/meta+wheel is a trackpad pinch, and Firefox binds
 * alt+wheel to history navigation.
 */
export const SCROLL_ZOOM_HELP =
  'The mouse wheel zooms over the tracks instead of scrolling the page; the view header above them still scrolls. ctrl+scroll (⌘+scroll on a Mac) zooms either way. Applies to every view in the app.'
