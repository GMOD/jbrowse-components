# packages/core/src/ui

`CascadingMenu` decides dismissal from the row **type** — a `checkbox`/`radio`
is a setting and keeps the menu open, everything else dismisses. So a settings
row states nothing. `keepMenuOpen` is only for exceptions, and in practice only
`false`: a checkbox whose click opens a dialog, swaps the display the rest of
the menu was built from, or unmounts the chrome hosting the menu.

The menu is a modal, so a test or figure spec that toggles a setting then
touches the view has to dismiss it first.

## Menu items: builders here, components there

`menuItems.ts` is a **React-free** entry, and `menuItems.purity.test.ts` fails
if it or anything it reaches imports react, @mui or @emotion. Its callers are
state models and plugin `menuItems`/`trackMenus` modules, evaluated when a
plugin installs, so reaching them through the barrel put ~80 Material components
in every host's first paint. **Build a row from `@jbrowse/core/ui/menuItems`;
render one from `@jbrowse/core/ui`.**

Each promotable builder is its plain counterpart **plus a pin**, and is written
that way, so a change to what a settings row _is_ reaches both forms. Both
literals had drifted the same way before they were shared, each naming its
decorations by hand and silently dropping `subLabel`/`disabled`.
`SettingRowOptions` is the one bag both kinds of row take.

Same rule inside a row: a menu item describes its trailing control
(`pin: { control, label }`) and `menuItemAdornment.tsx` builds it at draw time.
`endAdornment` takes a raw element for content nothing can describe — reach for
it last, since a builder that sets it drags its whole component graph into every
caller. `icon` is still an element type; see
`agent-docs/reference/EAGER_BUNDLE.md`.

## State that hides things declares itself: `Reversible`

Anything that narrows or marks what the user sees is declared once as
`{ count, label?, icon?, clear }`, keyed into a `Reversibles` record. The count
in "Filter by... (n)", the undo rows and what "Clear all filters" clears are
then all **derived from that one list**. Those three drifted apart repeatedly
and every failure was silent — a set with no undo row, an undo derived from the
state's _absence_ so it vanished with what it undid, a count derived from a
different predicate than the state's effect.

- **The seam is a method, not a getter.** `const { x } = self` on a getter
  evaluates once at composition time and freezes that value, so a subclass
  super-capturing it gets a stale snapshot.
- **Narrowing and marking are separate lists** — `featureNarrowings` (hide data;
  counted, cleared as a group) and `featureMarks` (highlights, pins; same rows,
  deliberately not the same count). A highlight is not filtering anything.

**Where it does not fit:** a display whose filters are edited in a dialog and
which offers no menu-level clear (`LinearAlignmentsDisplay`) keeps a plain
`activeCount`. The shape is for menus that own the undo.

## Design tokens: `palette.ts` for colors, `styleTheme.ts` for the rest

`makeStyles` hands a component **`JBrowseStyleTheme`** — palette, spacing,
shape, type scale — not MUI's `Theme`. Deliberately a subset, so `theme.zIndex`
or `theme.shadows` is a compile error rather than a silent dependency on a
component library; layering lives in `zIndexes.ts`. `PaletteProvider` supplies
colors alone and is what an embedding app mounts; `StyleThemeProvider` supplies
the whole thing from `session.styleTheme` and is what JBrowse's products mount.
`util/tss-react/muiFree.test.ts` fails if `makeStyles` reaches `@mui/*` again.

## Colors

`palette.ts` is the single source of truth — `theme.ts` builds the MUI theme
over it and holds no colors of its own. Colors shared with RPC workers (no theme
context) are plain `export const` CSS strings — import them directly, never a
fallback copy or a `theme.palette` hop. Theme-varying colors belong on
`StringColors`, with a value in `lightStringColors` and an override in
`darkStringColors`. A JSDoc `#color <group> | <label> | <description>` tag
surfaces one as a swatch row in the website guides.
