---
status: Accepted
summary: "A variant row with no color of its own takes its haplotype walk's color from a graph track in the same view: the graph display publishes `haplotypeColors` by PanSN sample and haplotype, and the variant display folds it into its rows"
---

# ADR-287: A variant row's label bar takes its walk's color from a graph track beside it

## Status

Accepted (2026-11-23). Feeds
[ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md)'s
resolution a row color it already reads; leaves
[ADR-284](adr-284-a-phased-alt-cell-takes-the-hue-of-its-alleles-frequency-rank.md)'s
allele hues as they are.

## Context

- A pangenome view stacks a multi-sample callset, one row per assembly or
  haplotype, over a graph track threading the same haplotypes as walks. The
  graph's WALKS key names each walk's color; the callset's row labels were plain
  text, so a reader matched a row to its thread by reading names in two places.
- Walk colors are dealt by pick order in the graph plugin
  (`resolveEncoding`), and a samples sheet's `color` column can override them
  (`sheetColorOf`). Nothing derives them from the name.
- The graph plugin (`jbrowse-plugin-graphgenomeviewer`) is a separate repo and
  loads at runtime, so neither side can import the other's model types.

## Decision

- **The graph display publishes data, the variant display reads it.**
  `LinearGraphDisplay.haplotypeColors` lists
  `{ sample, haplotype?, color }` for each haplotype it draws in one color,
  named as PanSN names it, `haplotype` absent for a walk named by its bare
  sample; a folded thread names every haplotype on it. A walk shaded along a
  ramp publishes nothing, since its color says where on the walk. The host
  reading a plugin member is plugin ABI
  (`reference/PLUGIN_ABI_STABILITY.md`).
- **The variant display folds the walk color into its own rows' `color`**
  (`walkColors.ts`), so ADR-207's resolution needs no new source: a row's
  `rows.colors` pin, else its `rows.color` value, else its own color, which is
  its samplesTsv `color` first, then its walk's. A reader's pin or a sheet
  color is never overridden; a sheet feeding both tracks already agrees.
- **Matching follows the graph's hover sync** (`rowWalks.ts`): a haplotype
  row takes the walk of its phase, VCF `HP0` matching PanSN haplotype 1, else
  a walk named by its bare sample; a sample row takes its sample's color only
  where every walk of the sample shares one. With two graph tracks, the first
  in track order with a match wins, for both row types.
- **The peers come from core's `viewDisplays`**, the lookup autoscale groups
  read, duck-typed on `haplotypeColors`. The published lists are compared by
  content and grouped by sample once per change, so an equal republish
  rearranges nothing.
- **The fold is view-only.** The tables export (`variantTables`) stands in no
  view and answers no walk colors, so its `color` column stays the row's own
  data.
- **It shows as the 4 px bar ADR-207 already draws beside the label**, not as
  text color. The bar is a row identity mark in the label column, away from the
  cells, which keep their allele hues; a light walk color stays readable
  because the text does not take it. No new key: the graph's WALKS key pairs
  each color with its name, and by ADR-207 the labels key stacked rows.

## Consequences

- With the graph track closed, or a ramped walk, nothing publishes and the
  callset draws as before.
- A dm6-only or sites-only callset has no row to match and is unaffected.
- The link reaches displays in the same linear view only; a separate
  GraphGenomeView is not a peer.
- Renaming `haplotypeColors` on either side turns the bars off with no error.

## Rejected

- **A general `linkedRowColors` hook in `TreeSidebarMixin`**: one display
  reads it, and folding into the row's own color reaches the same resolution
  with no new parameter on `resolveRowColors` or the arrangement dialog's
  model.
- **A deterministic name→color function both sides call**: the graph deals
  colors by pick order and lets a sheet or a reader override them, so a hash
  would disagree with what the graph draws, and two names can collide.
- **A session-level sample→color map the graph writes**: a second home for a
  value the graph display already computes, which must be cleared when the
  track closes; a view-scoped read of the peer's getter has no state to go
  stale.
- **Writing `rows.colors` on the variant display from the graph**: pins are the
  reader's arrangement and persist in the session, so a walk recolor would
  leave stale pins behind.
- **A shared samplesTsv `color` column as the only mechanism**: it works today
  and stays, but asks the author to hand-list colors the graph already deals.
- **Coloring the label text**: pale walk colors fail on the label background,
  and colored text beside colored cells reads as an allele hue.
