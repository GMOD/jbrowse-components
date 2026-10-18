---
name: adr-232-external-writers-and-figures
description: "ADR-232 is built, reviewed and released in v5.0.0-beta.15, with jb2hubs and ggjbrowse moved to its names (2026-10-18). Left: @jbrowse/tables' trusted publisher, whose 404 stopped beta.15's publish after 52 of 60 packages, and the sashimi lane question."
---

# ADR-232: what is left after beta.15

[ADR-232](../architecture-decision-records/adr-232-a-predicate-lives-where-what-it-selects-lives.md)
is built and shipped in v5.0.0-beta.15. jb2hubs (pangenome links, the bovine
config) and ggjbrowse (engine built from the beta.15 tag with
`~/src/ggjbrowse/scripts/build-js.sh`, its R settings renamed) follow its names.

## Waiting on Colin

- **`@jbrowse/tables` has no working trusted publisher.** Its one release,
  5.0.0-beta.13, was published by hand; CI's OIDC exchange 404s for it alone
  (every other package publishes as GitHub Actions), so beta.15's Publish run
  stopped there with `pnpm publish -r`. Still at beta.14 or earlier:
  `@jbrowse/tables`, `plugin-data-management`, `plugin-sv-inspector`,
  `jbrowse-blat-proxy`, `img`, `react-app2`, `react-circular-genome-view2`,
  `react-linear-genome-view2`. Once npm trusts `GMOD/jbrowse-components`'
  `publish.yml` for it, `gh run rerun 39155641995 --failed` publishes the rest
  (pnpm skips a package already at the version), and ggjbrowse takes releases
  with `~/src/ggjbrowse/scripts/take-release.sh` again.
- **Sashimi lane placement**: the arcs keep the overlay by default and draw
  in a strip below coverage while it is hidden. Colin may want a
  ggjbrowse-style lane above coverage: ask before building.

## Settled (don't reopen without new evidence)

- **The model getters keep their names** where a slot moved into a band:
  the variant display's `showVariantLane`, `variantLaneHeight` and
  `variantLaneLabels` read `variants`, and MAF's `showAlignments`,
  `rowProportion` and the rest read `alignments`.
- **No lift for a niche v4 toggle**: `displayDirectionalChevrons` loads at
  the default (Colin).
- **A connector paints as its arc**, so a connection between chromosomes is
  inter-chromosomal orange; four cancer_sv figures and the bezier golden were
  reshot for it.
- **`filter.tags` stays a list of `{ tag, value }`** (memory
  `explicit-records-over-keyed-maps`).
- Declined with recorded reasons: a schema `omits` option (ADR-232), wiggle
  `aggregate` → `summary` (ADR-216), `color.scale: 'none'` (ADR-154),
  facet-only color fields (ADR-230), `extent` → `showExtent` (ADR-216),
  `treeProvenance` out of the plot (ADR-157), `modifications` into
  `baseColor` (comment at the slot), a bare string as a field everywhere
  (ADR-159/215), `encoding.row` → `lane` and one `labels`/`text` word
  (ADR-232 sweep), `coverage.minAlleleFraction` rename (ADR-232).
- Open, low urgency: every color object taking the mark display's `breaks`
  and `missingLabel` (additive, can follow 5.0); the breakpoint split view's
  connectors still color by orientation alone.
