---
name: colour-menu-default-and-grammar-ideas
description: Two calls left open by the 2026-09-21 multiway review follow-up, both Colin's to make. Canvas's colour menu Default drops a track author's colour and reads a kept one as Solid or Attribute, while multiway's Genes Default returns to it; converging on multiway's meaning restructures canvas's radios. And whether per-zoom block ribbons earn a sentence in the parked block-ribbon idea. Read before touching either colour menu's Default; delete once both are decided.
---

# Colour-menu Default, and one grammar idea

The review of the 2026-09-20 multiway work landed its follow-ups: one
animation deadline for canvas and multiway (`installAnimationDeadline` in
`packages/display-kit/src/displayAutoruns.ts`), and synteny text-column labels
coloured by core's categorical rule, the same in every window and session
(`categoricalColor` in `packages/synteny-core/src/colorFunctions.ts`). Two
questions need a decision before anyone builds anything.

## Canvas's Default drops the author's colour

Multiway's **Color by... → Genes → Default** (`setGeneColorBy('')`) keeps
`color.value`, so a tutorial's `jexl:` colour comes back. Canvas's **Default**
(`defaultColorItem` in `plugins/canvas/src/LinearBasicDisplay/trackMenus.ts`)
calls `setFeatureColor(undefined)`, and `setSubschema` builds a fresh node with
no `value`: a hub track's own colour is gone, and Strand and Attribute replace
it the same way. `colorByMode` (`colorViews.ts`) also reads any `value` as
`solid` or `attribute`, so a hub track with its own colour opens with Solid or
Attribute checked rather than Default.

Converging on multiway's meaning needs four changes:
- make canvas's radios field-only (Default, Strand, Attribute);
- turn **Solid color...** into an action that writes `value`;
- have `setFeatureColor` and `setColorScale` pass `value` through;
- derive `colorByMode` from the field alone.

That touches `colorViews.ts`, `baseModel.ts` and `trackMenus.ts`, plus the
variants display, which reuses `defaultColorItem`, and any test pinning
`'solid'`. It changes the most-used track menu, so it waits on Colin.

## Per-zoom block ribbons

[multiway-synteny-lgv-track](../ideas/collections/multiway-synteny-lgv-track.md)
parks collinear block ribbons because they change what a ribbon is to hover.
The review proposed drawing blocks only below some zoom as the answer to that
blocker. Against it: ribbons that switch between blocks and genes as the zoom
crosses the threshold would read as a new flicker, now that lane moves
animate. If Colin wants it kept, it is one sentence in that parked paragraph,
not a new entry. **Match anchor scale**, the review's other proposal, has been
listed in the same file since 2026-08-24.
