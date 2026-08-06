A `ref` on `<LinearGenomeView>` gives you the live view model. Its
`.session.view` can be read, mutated and driven from components outside the view
tree — "jump to this gene" buttons, search-result lists, programmatic tours.

[`navToLocString`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navtolocstring)
takes what a user would type (`ctgA:1-5,000`, `chr1:1m-2m`).
[`navToLocations`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navtolocations)
takes `{ refName, start, end }` objects, which skips a formatting round-trip
when you already have coordinates from a backend; pass several to land in a
multi-region view.

Both are async and both **reject on input they can't resolve**, so a box with no
`.catch` looks like it ignored the typo.

There is also a lower-level
[`navTo`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navto)
that only moves within the currently displayed regions and won't re-set them —
rarely what external navigation wants. Anything marked `#action` in the
[state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/) is callable
the same way.
