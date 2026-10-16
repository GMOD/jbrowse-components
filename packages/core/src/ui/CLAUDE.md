# packages/core/src/ui

## Menus

- **A `checkbox`/`radio` row keeps `CascadingMenu` open; everything else
  dismisses.** `keepMenuOpen: false` is for a checkbox that opens a dialog or
  replaces the display the menu was built from. A test or figure spec that
  toggles a setting must dismiss the menu before touching the view.
- **Build rows from `@jbrowse/core/ui/menuItems`** (React-free, loaded at plugin
  install); render from `@jbrowse/core/ui`.
- **`toggleItem` over a setter, not `checkboxItem`.**
- **A shared builder never sets `endAdornment` or `icon`** — the element drags
  its component graph into every caller
  (`agent-docs/reference/EAGER_BUNDLE.md`).
- A builder wrapping `SettingRowOptions` passes the whole bag through; narrowing
  it drops fields silently.

## `Reversible`: state that hides things declares itself

Anything narrowing or marking what the user sees is one
`{ count, label?, icon?, clear }` entry. The filter count, the undo rows and
"Clear all filters" all derive from that list.

- **The seam is a method, not a getter** — `const { x } = self` on a getter
  freezes the composition-time value for a super-capturing subclass. The same
  holds for any extension seam.
- `featureNarrowings` hide data; `featureMarks` (highlights, pins) don't.
  `filterMenuItems` takes only narrowings.
- `jexlFilterNarrowing` counts "override differs from config", never a length:
  an admin's filter is not a user narrowing.

## Styling

- `makeStyles` hands a component `JBrowseStyleTheme`, a deliberate subset of
  MUI's `Theme`; layering is `zIndexes.ts`.
- An embedding app mounts `SessionPaletteProvider`, not bare `PaletteProvider`.
- **An `sx` cannot override a `makeStyles` class on the same element** — the tss
  class wins regardless of specificity. Compose a second rule with `cx`.
- **A class on a `Paper` sets `backgroundColor`, never `background`**, which
  erases MUI's dark-theme elevation overlay.
- **`palette.ts` is the single source of colors.** Worker-shared colors are
  plain `export const` strings, imported directly. `primary` stays midnight in
  dark theme; a mark on the page ground (checkbox, selection, crosshair) uses
  `accent`.
