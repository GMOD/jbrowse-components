---
title: Spreadsheet view
description: Import tabular data as a searchable feature table
guide_category: Views
---

The spreadsheet view loads a tabular file as an interactive table (one row per
feature) that you can sort, filter, and jump from into a genome view. It backs
the [SV inspector](/docs/user_guides/sv_inspector_view), but can also be used on
its own for any tabular genomic data.

## Opening a spreadsheet view

- Launch **Spreadsheet view** from the **Add** menu in the main menu bar
- In the import form, pick an assembly and supply a file (URL or local)

Supported formats (the type is detected from the extension):

- CSV, TSV
- VCF or VCF.gz
- BED, BED.gz
- BEDPE, BEDPE.gz
- STAR-Fusion output

## Working with the table

- Click a column header to sort; use the column and text filters to narrow rows
- Each row has a feature menu (triangle dropdown) that can:
  - Open in linear genome view - navigate an LGV to that feature
  - Open in breakpoint split view - for paired/breakend rows, open the two
    breakpoints stacked

For long-range structural variants specifically, the
[SV inspector](/docs/user_guides/sv_inspector_view) pairs this table with a
whole-genome circular overview and cross-filters the two together.

## See also

- [SV inspector view](/docs/user_guides/sv_inspector_view)
- [Circular genome view](/docs/user_guides/circular_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
