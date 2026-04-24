# packages/core/src/ui

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

Import these constants directly — do **not** add a fallback copy of the value
elsewhere in the codebase, and do not thread them through `theme.palette` just
to retrieve them in worker code. The exported constant _is_ the value; there is
no fallback needed.

Colors that are only used in React components and can vary per user theme belong
in the `Palette` / `PaletteOptions` interfaces and the `addMissingColors`
function, following the existing `modificationFwd` / `modificationRev` pattern.
