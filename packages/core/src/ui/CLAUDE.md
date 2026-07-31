# packages/core/src/ui

## Menu rows: a checkbox/radio keeps the menu open

`CascadingMenu` decides dismissal from the row TYPE (`staysOpenOnClick` in
`MenuTypes.ts`) — a `checkbox`/`radio` is a setting and the menu stays up, every
other row is an action and dismisses. So a settings row states nothing, and a
hand-written `{ type: 'checkbox' }` literal behaves like one from
`checkboxItem`.

`keepMenuOpen` is only for exceptions, and in practice only `false`: a
checkbox/radio whose click opens a dialog ("Custom...", "Solid color..."), swaps
the display the rest of the menu was built from (`BaseTrackModel`'s "Display
types"), or unmounts the chrome hosting the menu (LGV / breakpoint "Show
header"). If a menu-shape test needs to assert the behavior, call
`staysOpenOnClick` rather than reading the flag.

Note the menu is a modal: while it is open everything behind it is `aria-hidden`
and its backdrop swallows the next click. A test or figure spec that toggles a
setting then touches the view has to dismiss the menu first.

## Color constants

`theme.ts` is the single source of truth for all rendering colors shared across
plugins. Colors that need to be consistent between the main thread and RPC
workers (which have no access to the MUI theme context) are exported as plain
`export const` CSS strings:

```ts
export const methylated5mC = '#ff0000'
export const unmethylated5mC = '#0000ff'
// …
```

Import these constants directly — do **not** add a fallback copy elsewhere, and
do not thread them through `theme.palette` to retrieve them in worker code.

Colors that are only used in React components and can vary per user theme belong
in the `Palette` / `PaletteOptions` interfaces and the `addMissingColors`
function, following the existing `modificationFwd` / `modificationRev` pattern.

## Documenting a color

A JSDoc `#color <group> | <label> | <description>` tag on a color definition
surfaces it as a swatch row in the website guides (rendered by
`website/scripts/api-docs/generateColorDocs.ts` into
`<!-- COLOR_TABLE <group> -->` markers). Order within a group follows source
order. This keeps the prose docs from drifting from the actual values.
