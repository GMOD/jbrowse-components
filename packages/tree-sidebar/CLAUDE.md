# tree-sidebar

## Hand-written hierarchy layout (`src/hierarchy.ts`)

`src/hierarchy.ts` is a small hand-written subset of what d3-hierarchy used to
provide (`hierarchy`, `leaves`, `descendants`, `links`, `sum`, `sort`, and a
`clusterLayout`/`assign*Y` dendrogram layout). d3-hierarchy is pure ESM and
breaks Jest, so it isn't used as an npm dependency — don't reintroduce it.
