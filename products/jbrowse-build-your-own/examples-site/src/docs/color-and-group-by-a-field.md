In grammar-of-graphics terms, Color by is a color scale and Group rows by is a
facet, each over a field. `applyPlot` writes `encoding.color` as
`{ field, scale: { domain } }` and `facet` as `{ field, sort }`: the palette
follows `domain`, and the facet stacks those rows first.
[Grouping and lane order](https://jbrowse.org/jb2/docs/config_guides/grouping_and_ordering/)
covers the facet on every display.
