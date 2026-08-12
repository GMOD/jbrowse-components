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
`promotableToggleItem`, `promotableRadioItem`, `promotableRadioItems`, plus the
menu types — and `menuItems.purity.test.ts` fails if it, or anything it reaches,
imports react, @mui or @emotion. It exists because the callers are state models
and plugin `menuItems`/`trackMenus` modules, which are evaluated when a plugin
installs: reaching them through the `index.ts` barrel put ~80 Material
components in every host's first paint. **Build a row from
`@jbrowse/core/ui/menuItems`; render one from `@jbrowse/core/ui`.**

Each promotable builder is its plain counterpart **plus a pin**, and is written
that way — `promotableToggleItem` builds its row through `checkboxItem`,
`promotableRadioItem` through `radioItem`, `promotableRadioItems` through
`radioItems`. So a change to what a settings row _is_ reaches both forms, which
is the failure `checkboxItem`'s own comment records (a menu regressing by
omission). Both literals had drifted the same way before they were shared: each
named its decorations by hand and so silently dropped
`subLabel`/`disabled`/`disabledHelpText`. `SettingRowOptions` is the one bag
both kinds of row take, so there is nothing left to spell twice.

The same rule inside a row: a menu item describes its trailing control
(`pin: { control, label }`) and `menuItemAdornment.tsx` builds `PinAdornment`
from it at draw time. `endAdornment` still takes a raw element, for content
nothing can describe (synteny's colour swatch) — reach for it last, since a
builder that sets it drags its whole component graph into every caller. `icon`
is still an element type, which is the one of these left; see
`agent-docs/reference/EAGER_BUNDLE.md`.

## State that hides things declares itself: `Reversible`

A filter, a hidden set, an applied "show only these", a highlight set — anything
that narrows or marks what the user sees — is declared once as
`{ count, label?, icon?, clear }`, keyed into a `Reversibles` record. The count
in "Filter by... (n)", the undo rows inside that submenu and what "Clear all
filters" clears are then all **derived from that one list** by `activeCount` /
`undoItems` / `clearAll`, and `filterMenuItems` takes the record in place of the
three computed separately.

It exists because those three drifted apart repeatedly, and every failure was
silent rather than loud: a set with no undo row at all (the canvas display's
pinned features, reachable only from the pinned feature's own right-click menu,
so a pin left on another chromosome could not be undone); an undo derived from
the state's _absence_, so it vanished with what it undid (the canvas colour
key's "×" was a one-way door for the session); a count derived from a different
predicate than the state's effect ("Filter by... (1)" for opening the dialog and
pressing Submit). LD and multi-sample variants each listed their filters twice,
once to count and once to clear.

Two rules that cost real bugs to learn:

- **The seam is a method, not a getter.** `const { x } = self` on a getter
  evaluates it once at composition time and freezes that value, so a subclass
  super-capturing it gets a stale snapshot. Every extension seam here is a
  method for that reason.
- **Narrowing and marking are separate lists.** The canvas display declares
  `featureNarrowings` (hide data — counted, cleared as a group) and
  `featureMarks` (highlights, pins — same rows, deliberately not the same
  count). A highlight is not filtering anything and must not appear in the
  "(n)".

**Where it does not fit:** a display whose filters are edited in a dialog and
which deliberately offers no menu-level clear — `LinearAlignmentsDisplay` —
keeps a plain `activeCount`. Declaring there would mean `clear` closures nothing
calls, or a flag to suppress the group row the declaration implies. The shape is
for menus that own the undo.

## Design tokens: `palette.ts` for colors, `styleTheme.ts` for the rest

`makeStyles` hands a component **`JBrowseStyleTheme`** — palette, spacing,
shape, type scale — not Material UI's `Theme`. It is deliberately a subset, so a
call site reaching for `theme.zIndex` or `theme.shadows` is a compile error
rather than a silent dependency on a component library; layering lives in
`zIndexes.ts`. `PaletteProvider` supplies colors alone and is what an embedding
app mounts; `StyleThemeProvider` supplies the whole thing and is what JBrowse's
products mount, from `session.styleTheme`, so a config `theme` setting `spacing`
or `typography` reaches both halves. `styleTheme.test.ts` holds the values to
Material's, and `util/tss-react/muiFree.test.ts` fails if `makeStyles` reaches
`@mui/*` again — see `agent-docs/reference/EAGER_BUNDLE.md` for why it must not.

## Colors

`palette.ts` is the single source of truth — `theme.ts` builds the MUI theme
over it and holds no colors of its own. Colors shared with RPC workers (which
have no theme context) are plain `export const` CSS strings — import them
directly, never a fallback copy or a `theme.palette` hop. Theme-varying colors
belong on the `StringColors` interface, with a value in `lightStringColors` and
an override in `darkStringColors` where dark mode differs. A JSDoc
`#color <group> | <label> | <description>` tag surfaces one as a swatch row in
the website guides.
