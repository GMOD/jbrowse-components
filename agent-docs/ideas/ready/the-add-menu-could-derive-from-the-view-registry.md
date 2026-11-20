---
name: the-add-menu-could-derive-from-the-view-registry
description: The empty-session ViewLauncher lists the view registry while the Add menu is hand-appended per plugin, so the two drifted until Breakpoint split view was missing from Add; deriving Add from the registry double-lists every outside plugin's own appendToMenu('Add') row.
---

# The Add menu could derive from the view registry

## Ruling

Land the cross-surface test now. Deriving Add comes later, and skips a view
type some plugin already appended, so an outside plugin is listed once.

Two surfaces open a view from nothing, and they are built differently:

- `ViewLauncher` (`packages/app-core/src/ui/App/ViewLauncher.tsx`, the
  empty-session dropdown) lists `pluginManager.getViewElements()` minus
  `viewMetadata.hiddenFromGUI`.
- The File > Add menu is whatever each view plugin pushed with
  `rootModel.appendToMenu('Add', …)` in its `configure`.

They drifted: Add listed six views while the launcher listed seven, because
`BreakpointSplitViewPlugin` never appended a row. The row now exists, but the
drift is a property of the design, not of that plugin.

## Why deriving is not a one-line change

- **Outside plugins already append their own rows.** An out-of-tree view plugin
  that calls `appendToMenu('Add', …)` keeps working today. If Add were also
  built from the registry, that plugin's view would appear twice, once derived
  and once appended, with no way to tell the two apart by label or icon.
- **Renaming Add orphans the same plugins.** Calling the menu "New view" would
  send every existing `appendToMenu('Add', …)` through `findOrCreateMenu`
  (`packages/app-core/src/menus.ts`), which creates a stray "Add" menu when none
  exists. The rows would survive, in a menu nobody expected.
- **Rows carry more than a name.** Each hand-written row picks its own icon and
  label (`Linear synteny view`, `SV inspector`), and `displayName` is not
  always the wording the menu wants.

`reference/PLUGIN_ABI_STABILITY.md` is the ledger this would land in.

## What a migration would need

- A derived list that **skips a view type some plugin already appended**, so an
  outside plugin is listed once; or a deprecation window in which
  `appendToMenu('Add', …)` is still honored and warns.
- An icon on `ViewType` (or its `viewMetadata`), so the derived row is not
  anonymous.
- If the menu is renamed, `findOrCreateMenu` mapping the old name `Add` onto the
  new menu, kept until the ABI ledger records the removal.
- The in-tree plugins' own `appendToMenu('Add', …)` calls deleted in the same
  change, and a test that Add and the launcher list the same view types.

## Until then

A test over both surfaces would catch the next missing row without any of the
above: build a session with the stock plugins, then compare the Add menu's labels
with the non-hidden registry entries.
