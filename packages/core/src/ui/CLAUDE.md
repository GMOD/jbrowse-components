# packages/core/src/ui

## `CascadingMenu` decides dismissal from the row type

A `checkbox`/`radio` is a setting and keeps the menu open; everything else
dismisses. So a settings row states nothing. `keepMenuOpen` is for exceptions,
in practice only `false`: a checkbox whose click opens a dialog, swaps the
display the menu was built from, or unmounts the chrome hosting it.

The menu is a modal, so a test or figure spec that toggles a setting then
touches the view has to dismiss it first.

## Builders here, components there

**Build a row from `@jbrowse/core/ui/menuItems`; render one from
`@jbrowse/core/ui`.** `menuItems.ts` is a React-free entry and
`menuItems.purity.test.ts` fails if anything it reaches imports react/@mui/
@emotion — its callers are evaluated at plugin install, so reaching them through
the barrel put ~80 Material components in every host's first paint.

- Each promotable builder is its plain counterpart **plus a pin**, written that
  way so a change to what a settings row _is_ reaches both forms.
  `SettingRowOptions` is the one bag both kinds take — a builder that
  hand-narrows it drops fields silently, which is what MAF's local `toggle`
  wrapper had done to three of the five.
- **`toggleItem`, not `checkboxItem`, for a checkbox over a setter.** It hands
  the setter the new value instead of leaving 40 rows to write `!` against the
  same expression they are `checked` by. Same shape `radioItems` already takes.
- A menu item **describes** its trailing control (`pin: { control, label }`);
  `menuItemAdornment.tsx` builds it at draw time. `endAdornment` takes a raw
  element and is the last resort — a builder that sets it drags its whole
  component graph into every caller. `icon` is still an element type;
  `agent-docs/reference/EAGER_BUNDLE.md`.

## State that hides things declares itself: `Reversible`

Anything narrowing or marking what the user sees is declared once as
`{ count, label?, icon?, clear }` in a `Reversibles` record. The "Filter by…
(n)" count, the undo rows and what "Clear all filters" clears are all **derived
from that one list** — they drifted apart repeatedly and every failure was
silent.

- **The seam is a method, not a getter** — `const { x } = self` on a getter
  freezes the composition-time value, so a super-capturing subclass gets a stale
  snapshot.
- **Narrowing and marking are separate lists** — `featureNarrowings` (hide data;
  counted, cleared as a group) and `featureMarks` (highlights, pins). A
  highlight isn't filtering anything.
- **Where it doesn't fit**: a display whose filters live wholly in a dialog with
  no menu-level clear keeps a plain `activeCount`. `LinearAlignmentsDisplay`
  used to be the example and no longer is — its read categories are menu rows,
  so it has real `clear`s to write and declares `narrowings`.
- **The jexl-filter entry is `jexlFilterNarrowing`**, shared by all three
  displays with that row. Its count is "the override differs from what the
  config declared", never a length: a filter an admin declared is not a user
  narrowing, and "Clear all filters" could not undo it anyway.

## Design tokens

`makeStyles` hands a component **`JBrowseStyleTheme`** — palette, spacing,
shape, type scale — not MUI's `Theme`. Deliberately a subset, so `theme.zIndex`
or `theme.shadows` is a compile error; layering is `zIndexes.ts`.
`SessionPaletteProvider` (colors, plus the `setThemeMode` write the worker's
baked labels derive from) is what an embedding app mounts — `PaletteProvider`
alone is the near miss it exists to close, and stays for a host supplying its
own palette. `StyleThemeProvider` (the whole thing, from `session.styleTheme`)
is what our products mount. `util/tss-react/muiFree.test.ts` fails if
`makeStyles` reaches `@mui/*`.

**`palette.ts` is the single source of truth for colors**; `theme.ts` builds the
MUI theme over it and holds none of its own. Colors shared with RPC workers are
plain `export const` CSS strings — import them directly, never a fallback copy
or a `theme.palette` hop. Theme-varying colors go on `StringColors`
(`lightStringColors` + a `darkStringColors` override). A JSDoc
`#color <group> | <label> | <description>` tag surfaces one as a swatch row in
the website guides.
