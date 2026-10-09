In grammar-of-graphics terms, Color by is a color scale and Group rows by is a
facet, each over a field. `applyPlot({ color })` and `setFacet` take the same
`{ field, domain }`: the scale assigns the palette in `domain` order, and the
facet stacks those values' rows first.
[Grouping and lane order](https://jbrowse.org/jb2/docs/config_guides/grouping_and_ordering/)
covers the facet on every display.
