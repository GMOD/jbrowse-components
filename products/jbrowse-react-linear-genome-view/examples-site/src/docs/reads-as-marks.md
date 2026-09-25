The picture above, as a grammar of graphics: the `formula` step is ggplot2's
`mutate()`, lifting the HP tag into a field; `facet` is `facet_grid(rows)`;
`pileup` packs each section into rows; and `span` is a `geom_rect` coloured by
the field. The
[mark display guide](https://jbrowse.org/jb2/docs/config_guides/mark_display/)
maps every name, and the
[methylation tutorial](https://jbrowse.org/jb2/docs/tutorials/methylation/)
reads these reads' 5mC calls.
