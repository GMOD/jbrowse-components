---
name: check-quoted-figures-reads-the-tutorials
description: The website rule against numbers that assert a result has a checker built for it, but `check-quoted-figures` only reads pages with a measurement block, none of them a tutorial; widening its scope to `tutorials/`, ratcheted per page, enforces the rule where the hand-copied run results are.
---

# `check-quoted-figures` reads the tutorials

[WEBSITE_WRITING.md](../../reference/WEBSITE_WRITING.md) §"Prose, captions,
cards" already draws the line: a number that names something (a variant's size,
a coordinate, a cohort size) is fine, and one stating what a figure could show
goes stale unflagged. Nothing enforces it on a tutorial.

[check-quoted-figures.ts](../../../website/scripts/check-quoted-figures.ts)
pulls every `<number><unit>` out of a page's prose and requires it in an
`agent-docs/` doc the page links or the JSDoc of a symbol it names. Its scope is
a page carrying a `BEGIN GENERATED MEASUREMENT` block, which only
`developer_guides/optimizations.md` and `developer_guides/memory.md` do. The
tutorials, whose numbers are copied by hand out of an analysis run, sit outside
it.

## Which numbers it should pass

- **A build parameter** the reader types: `--fst-window-size 2000`, `--flank
  600`, a region, a MAF floor. These appear in the page's own fences or build
  script, so counting those as cited sources passes them.
- **A result** (block lengths, window counts, sample counts, file sizes) fails:
  the figure carries it, and the prose copy rots alone.
- A result inside a config block, such as `dog10k_selection`'s reference line
  `"value": 0.295`, is not prose and is not read. The page says the line is a
  quantile of its own windows and that rebinning means re-taking it, which is the
  pattern to copy.
- A `<Figure>` caption is not fenced, so the checker reads it as prose. A count
  on 2026-08-31 found 36 of 371 tutorial captions carrying a value after the
  rule's exemptions, nearly all a window width naming the frame; the ratchet
  absorbs those, or the page's figure spec counts as a cited source.

## The change

- Put `website/docs/tutorials/` in scope alongside the measurement pages.
- Count a page's own fences and its `scripts/build_*.sh` as cited sources.
- Ratchet per page from a fresh count, so existing pages can only lose figures.
  A count on 2026-08-31 found 48 `<number><unit>` tokens in `population_cnv`'s
  prose, 46 in `population_genomics` and 32 in `dog10k_svs`, against 0 in
  `methylation` and `mcscan_synteny_grape_peach`; the corpus has changed since,
  so re-take it.
