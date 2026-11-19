---
name: lazy-hover-and-picker-ui-in-tree
description: "16 in-tree files deep-import the eager BaseTooltip, so @floating-ui (about 7 KB gzipped, 3% run) loads with every track, and react-colorful rides along the same way. Lazy versions cost a chunk load on the first hover or picker open."
---

# Lazy hover and picker UI in tree

`packages/core/src/ui/index.ts` exports `BaseTooltip` from
`LazyBaseTooltip.tsx`, because the eager one reaches `@floating-ui`. In-tree
code deep-imports `@jbrowse/core/ui/BaseTooltip`, which is eager, so a page
with a track loads floating-ui's react, dom and core modules before anything is
hovered. `ColorPicker.tsx` imports `react-colorful` the same way.

Coverage, 2026-11-19, five volvox loads with no hover: floating-ui 7.3 KB of
7.5 KB gzipped unused, `react-colorful.ts` 2.9 of 3.1 KB.

## The call

The first tooltip waits on a chunk, the cost the lazy barrel export already
accepts for apollo. A tooltip that appears a frame late on the first hover is
the trade. `EAGER_BUNDLE.md`'s rule applies: `fallback={null}` claims the
component takes no space, which a tooltip portal satisfies and an inline picker
may not.
