---
title: Spreadsheet view
description: Import tabular data as a searchable feature table
guide_category: Views
---

The spreadsheet view loads a tabular file as an interactive table (one row per
feature) that you can sort, filter, and jump from into a genome view. It backs
the [SV inspector](/docs/user_guides/sv_inspector_view) and also works alone.

## Opening a spreadsheet view

- Launch **Spreadsheet view** from the **Add** menu in the main menu bar
- In the import form, pick an assembly and supply a file (URL or local), or pick
  **Open from track** to read a track already in the session

The form reads VCF, BED and BEDPE files, gzipped or not, and STAR-Fusion output.
It detects the type from the extension, and a STAR-Fusion `.tsv` from its file
name or its `#FusionName` header.

## Working with the table

Click a column header to sort, and use the column and text filters to narrow
rows.

<Figure src="/img/spreadsheet/feature_menu.png" caption="An SV callset in the spreadsheet view, with the feature menu open from the triangle beside the first row's location." />

**Open in breakpoint split view** stacks the row's two breakpoints, for a paired
or breakend row.

For long-range structural variants specifically, the
[SV inspector](/docs/user_guides/sv_inspector_view) pairs this table with a
whole-genome circular overview and cross-filters the two together.

## See also

- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/circular_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
