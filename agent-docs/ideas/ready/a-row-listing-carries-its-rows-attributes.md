---
name: a-row-listing-carries-its-rows-attributes
description: A mark display over a VCF sees none of its samples, and one over a MAF none of its samples table's columns, and no mark display bands a facet by a listed attribute. Read before adding a row attribute source or a listRowSources.
---

# A row listing carries its rows' attributes

`ListedRowSource.attributes`
(`packages/core/src/data_adapters/BaseAdapter/rowSources.ts`) carries a row's
fields besides its name, label and color, and the listing's `warnings` what the
samples table disagreed with. `MultiWiggleAdapter.listRowSources` fills both,
and the mark family spreads the attributes under each listed row before
`rows.groups` tags `group`, so `rows.filter`, `rows.color` and
`rows.annotations`
([ADR-260](../../architecture-decision-records/adr-260-row-annotations-are-color-columns-beside-the-row-labels.md))
read a subtrack's `group` and a samples table column there. A row whose table
column and `rows.groups` entry both say `group` takes the entry's.

What is left:

- **The VCF adapters list no rows**, so a mark display over a VCF sees none of
  its samples. ADR-189 names the listing (`field: 'samples'`, behind a
  `flatten` over `samples`); build it on `vcfSourcesAndWarnings`, which already
  strips the variant display's haplotype-row fields. Uncached on purpose: a
  split VCF reports a contig that failed to open as a warning, and
  `cachedSetup` would keep that for the adapter's life. `MarkScanPlotFields`
  calls `listRowSources` on every scan, so a split VCF's listing there opens
  every contig header for a count it discards unless the field is `source`.
- **A MAF listing carries no attributes**: `mergeSamplesTsv`
  (`plugins/maf/src/util/getSamples.ts`) keeps only `label`, `color` and
  `assemblyName`. The MAF display stays without them (ADR-260, ADR-257's
  Parked list), but a MAF on the mark display reads the listing and has
  `rows.color`, `filter` and `annotations`, so keeping the other columns there
  needs no ADR change.
- **A facet does not band by a listed attribute.** `rowAttributeFields`
  (`markConfigViews.ts`) is config alone, so `facet: 'group'` over a
  multi-BigWig's subtrack `group` splits the features rather than banding the
  rows. Counting listed attributes there flips `bandsRows` when the listing
  lands, after a first fetch that `fetchNeeded` does not hold for it.

## Declined with it

A `rows.data` table in config, each column a map by row name or a list of
`{ match, value }` regexes, was reviewed on 2026-11-09 and dropped. A map by
row name has to clear when `rows.field` changes and a regex list has to
survive it (ADR-257's write rule), so one member cannot hold both, and the
samples table already is the per-row table. `rows.groups` on the variant
display stays in ADR-257's Parked list.
