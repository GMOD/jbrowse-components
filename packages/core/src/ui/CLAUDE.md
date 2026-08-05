# packages/core/src/ui

`CascadingMenu` decides dismissal from the row **type** — a `checkbox`/`radio`
is a setting and keeps the menu open, everything else dismisses. So a settings
row states nothing. `keepMenuOpen` is only for exceptions, and in practice only
`false`: a checkbox whose click opens a dialog, swaps the display the rest of
the menu was built from, or unmounts the chrome hosting the menu.

The menu is a modal, so a test or figure spec that toggles a setting then
touches the view has to dismiss it first.

## Menu items: builders here, components there

`menuItems.ts` is a **React-free** entry — `checkboxItem`, `radioItems`,
`promotableToggleItem`, `promotableRadioItem`, plus the menu types — and
`menuItems.purity.test.ts` fails if it, or anything it reaches, imports react,
@mui or @emotion. It exists because the callers are state models and plugin
`menuItems`/`trackMenus` modules, which are evaluated when a plugin installs:
reaching them through the `index.ts` barrel put ~80 Material components in every
host's first paint. **Build a row from `@jbrowse/core/ui/menuItems`; render one
from `@jbrowse/core/ui`.**

The same rule inside a row: a menu item describes its trailing control
(`defaultForAll: { control, label }`) and `menuItemAdornment.tsx` builds
`DefaultForAllAdornment` from it at draw time. `endAdornment` still takes a raw
element, for content nothing can describe (synteny's colour swatch) — reach for
it last, since a builder that sets it drags its whole component graph into every
caller. `icon` is still an element type, which is the one of these left; see
`agent-docs/reference/EAGER_BUNDLE.md`.

## Colors

`palette.ts` is the single source of truth — `theme.ts` builds the MUI theme
over it and holds no colors of its own. Colors shared with RPC workers (which
have no theme context) are plain `export const` CSS strings — import them
directly, never a fallback copy or a `theme.palette` hop. Theme-varying colors
belong on the `StringColors` interface, with a value in `lightStringColors` and
an override in `darkStringColors` where dark mode differs. A JSDoc
`#color <group> | <label> | <description>` tag surfaces one as a swatch row in
the website guides.
