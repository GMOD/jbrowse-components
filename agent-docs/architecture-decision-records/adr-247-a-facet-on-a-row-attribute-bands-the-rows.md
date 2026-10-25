---
status: Accepted
summary: "On the mark display a facet section is a band: under `rows`, a facet on a row attribute stacks the rows in labelled bands on the main thread, through `TreeSidebarMixin`'s `rowBanding`, where a facet on a feature field still splits the features in the worker and draws in the rows' place. A row attribute is the `group` a new `rowGroups` slot writes, so whether a facet bands or splits is config, known before a feature loads. The bands order by `facet.sort`, then the groups as `rowGroups` declares them; a clustering run clusters each band apart; `rowColor` can color by `group`. `rowGroups` and its helpers move from the multi-row display into tree-sidebar. The last gap of the multi-row-on-marks handoff before the swap; amends ADR-169"
---

# ADR-247: A facet on a row attribute bands the rows

## Status

Accepted (2026-10-25), on Colin's call in
`ideas/ready/multi-row-is-the-mark-display-with-a-default-plot.md`: "a facet
section is a band". Amends
[ADR-169](adr-169-a-band-draws-the-clade-of-its-rows.md), whose bands of rows
reach the mark display.

## Context

On the multi-row display `facet: 'group'` stacks the rows in bands by the
`group` `rowGroups` tags them with. On the mark display a facet always split
the features in the worker into sections; beside `rows` it drew alone, and
the `rows` slot's doc called bands of rows "not drawn yet".

## Decision

- **One meaning for `facet`, a section is a band.** A facet on a feature
  field splits the features in the worker, as before. Under `rows`, a facet
  on a row attribute bands the rows instead: the worker splits by `rows`
  alone, and `rowBanding` stacks them, so ADR-169's band labels, band trees
  and stale-tree hint come with it.
- **A row attribute is config.** `rowGroups`, the multi-row display's slot,
  joins the mark display and writes `group` on each row it matches
  (`expandRows`). `bandsRows` reads only `facet`, `rows` and `rowGroups`, so
  the first fetch already asks for the right split.
- **`facet` reads the worker's facet.** The getter answers `undefined` while
  the facet bands the rows, so the section chips, hides and order rows stay
  off; `declaredFacet` is the slot as written.
- **Bands order by `facet.sort`**, then the groups in `rowGroups` order, the
  rows no entry matches last. A clustering run under two or more bands sends
  `clusterPartition`, as multi-row's does.
- **The rows carry attributes now**, so `rowColorFields` takes the mixin's
  default and `rowColor: { field: 'group' }` colors the bands' rows.
- **The rules know it.** `markProblems` takes `rowAttributes`, and
  `rows-beside-facet` fires only for a facet on a feature field; `jbrowse
  validate` passes `group` where a display declares `rowGroups`.
- `rowGroups`, its schema and `tagRowGroups` move to tree-sidebar
  (`rowGroups.ts`, `rowGroupConfigSchema.ts`); the multi-row display
  re-exports them until it retires.

## Consequences

- A row listed by a multi-source adapter carries its own fields, which no
  facet bands by yet: only `group` counts as a row attribute.
- Hiding a band, as a facet section hides, is not offered.

## Rejected alternatives

- **Banding on whatever field the loaded rows turn out to carry.** The rows
  arrive with the data, so the first fetch would split by the facet and the
  next by `rows`, refetching and redrawing once per track.
- **A separate slot for bands of rows.** Colin chose one word.
