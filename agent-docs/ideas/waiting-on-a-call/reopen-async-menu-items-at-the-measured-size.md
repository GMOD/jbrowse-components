---
name: reopen-async-menu-items-at-the-measured-size
description: "Async menu items were declined at 24.6 KB gzipped as a plugin API change. Coverage now puts menu-builder code that never runs at about 39 KB gzipped across 93 files; decide whether that justifies the change in the v5 window."
---

# Reopen async menu items at the measured size

`EAGER_BUNDLE.md` declines "async menu items for the menu code (24.6 KB)": a
display's `trackMenuItems` and context menus are synchronous, so their builders
load with the display model.

## The new number

The coverage probe
([a-coverage-probe-that-maps-unused-bytes-to-source-files](../ready/a-coverage-probe-that-maps-unused-bytes-to-source-files.md))
over the empty shell, an empty LGV, a wiggle track, four tracks and a CRAM
track, 2026-11-19: files matching `menu`/`Menu` hold about 44 KB gzipped, 39 KB
of it never run. The largest are `variantDisplayMenuItems.ts`, `groupByMenu.ts`,
the alignments `contextMenu.ts`, `LinearGenomeView/menuItems.ts` and
`featureContextMenu.ts`.

That figure gzips each file alone, so it overstates; rebuild with a candidate
change and read `measure-web-bundle --worker` before quoting a saving.

## The call

- A menu that opens a frame later, against bytes on every track page.
- Whether a lazy builder can sit behind the existing synchronous getter (a
  placeholder item that resolves) without a plugin-facing change, which would
  turn this into a `ready/` item.
