---
name: sv-search-language
description: The SV inspector import form matches query strings against spreadsheet columns, so it misses variants originating from a chromosome rather than naming it; a breakend/type/length/INFO language with AND/OR would not.
---

# Expressive SV search language for the SV inspector import form

Current import-form filtering matches query strings like `CHR2=17` against the
spreadsheet columns — narrow (won't catch variants *originating* from chr17, only
those naming it in a column). A richer SV query language (by breakend chrom/pos,
type, length range, INFO fields, AND/OR) would be more useful. Net-new feature,
not a screenshot defect. (Was: sv_inspector_importform_filtered review item.)
