Some TODO items

Please remove todo items from this list and move to PANGENOME_COMPLETED.md when
done

## general

- remove sort by genotype option from multivariant track menu varianttrack
  regular
- What descriptions are hidden
- toggled off for small insertions, make the triangle fade to line dynamically
- zoom level subpixel multi-sample variant rendering, try to allow some subpixel
  don't hard force to 1px width for features
- multi-rubberband synteny: there is z-index fighting, when you click and drag
  the menu mouseover is under tooltips

## ideas

- Create the concept of a Multi-bed track type, similar to multi-wiggle e.g.
  chromatin state bed files, or putting repeatmasker different repeat types on
  different rows (the multi-bed could use multiple bed files or a signle file as
  source, single file example is repeatmasker, splitting on repeattype e.g.
  attribute of feature)

## multi-synteny

- Render letters in mismatches, insertions, deletion text
- make large insertion indicators
- Remove the reference genome as row from multilgvsyntenydisplay
- Improve tooltip to base level with flatbush like plugins/alignments
- Tooltip slowdowns and obscures during zoom
