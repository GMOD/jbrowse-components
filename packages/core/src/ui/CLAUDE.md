# packages/core/src/ui

`CascadingMenu` decides dismissal from the row **type** — a `checkbox`/`radio`
is a setting and keeps the menu open, everything else dismisses. So a settings
row states nothing. `keepMenuOpen` is only for exceptions, and in practice only
`false`: a checkbox whose click opens a dialog, swaps the display the rest of
the menu was built from, or unmounts the chrome hosting the menu.

The menu is a modal, so a test or figure spec that toggles a setting then
touches the view has to dismiss it first.

## Colors

`theme.ts` is the single source of truth. Colors shared with RPC workers (which
have no theme context) are plain `export const` CSS strings — import them
directly, never a fallback copy or a `theme.palette` hop. Theme-varying colors
belong in `Palette`/`addMissingColors`. A JSDoc
`#color <group> | <label> | <description>` tag surfaces one as a swatch row in
the website guides.
