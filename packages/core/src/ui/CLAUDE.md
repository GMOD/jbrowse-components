# packages/core/src/ui

`CascadingMenu` decides dismissal from the row **type** — a `checkbox`/`radio`
is a setting and keeps the menu open, everything else dismisses. So a settings
row states nothing. `keepMenuOpen` is only for exceptions, and in practice only
`false`: a checkbox whose click opens a dialog, swaps the display the rest of
the menu was built from, or unmounts the chrome hosting the menu.

The menu is a modal, so a test or figure spec that toggles a setting then
touches the view has to dismiss it first.

## Colors

`palette.ts` is the single source of truth — `theme.ts` builds the MUI theme
over it and holds no colors of its own. Colors shared with RPC workers (which
have no theme context) are plain `export const` CSS strings — import them
directly, never a fallback copy or a `theme.palette` hop. Theme-varying colors
belong on the `StringColors` interface, with a value in `lightStringColors` and
an override in `darkStringColors` where dark mode differs. A JSDoc
`#color <group> | <label> | <description>` tag surfaces one as a swatch row in
the website guides.
