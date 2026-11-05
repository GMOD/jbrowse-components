# packages/core/src/ui

- **Dismiss the menu before touching the view in a test or figure spec that
  toggles a setting** — a `checkbox`/`radio` row keeps `CascadingMenu` open.
- **Leave `endAdornment` and `icon` off a shared menu builder** — the element
  drags its component graph into every caller
  (`agent-docs/reference/EAGER_BUNDLE.md`).
- **Declare state that hides or marks features as a `Reversible` entry**
  (`featureNarrowings` hide, `featureMarks` mark): the filter count, the undo
  rows and "Clear all filters" all derive from that list.
- **Make an extension seam a method, not a getter** — `const { x } = self` on a
  getter freezes the composition-time value for a super-capturing subclass.
- **Override a `makeStyles` class by composing a second rule with `cx`**; an
  `sx` on the same element loses to the tss class regardless of specificity.
- **Set `backgroundColor` in a `Paper`'s class, not `background`**, which erases
  MUI's dark-theme elevation overlay.
- **Color a mark on the page ground (checkbox, selection, crosshair) with
  `accent`**; `primary` stays midnight in dark theme.
