---
name: a-query-language-for-the-sv-inspector-s-search
description: A query language for the SV inspector's search
area: rendering-and-displays
---

# A query language for the SV inspector's search

proposed as
`ideas/sv-search-language.md`, and closed 2026-08-16 by giving the grid two
columns instead. The complaint was real: a search matched the spreadsheet's
columns, so it found variants that NAMED a chromosome and missed the ones that
merely reached it, because a breakend's far end lives inside the ALT string
and no column carried it. A `Mate` column carries it now, and searching
`chr5` on the C-GIAB benchmark returns 13 rows — the 12 whose own CHROM is
chr5, plus the one whose only chr5 is its mate, which is exactly the record
the old search could not reach.

What is left of the proposal was already there. The grid's own filter panel
has per-column operators and an AND/OR selector, `SV size` is a numeric column
so a length range is `>` and `<` on it, every INFO field is already a column,
and the type dropdown names classes. So the language would have been a second
query surface competing with one that ships with the table — a parser, an
evaluator, error reporting and docs, to reach what two `valueGetter`s reach.

**The lesson generalizes**: when a table cannot answer a question, ask what
column is missing before designing a language over the columns it has.
