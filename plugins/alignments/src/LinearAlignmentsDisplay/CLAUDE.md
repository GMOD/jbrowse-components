# LinearAlignmentsDisplay

Settings storage and fetch/render tiering: `agent-docs/ARCHITECTURE.md`. The arc
band: [reference/ARC_BAND.md](../../../../agent-docs/reference/ARC_BAND.md).
Layout stays main-thread per
[ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md).

**A getter here that computes rather than reads belongs in a sibling module**,
with the getter left as the memoized adapter — `groupedDataMaps.ts`,
`groupLayout.ts`, `lanes.ts`, `readLookup.ts`, `sectionLayout.ts`. That is what
lets each pass be unit-tested without booting an MST tree, and it is why
model.ts is a chain of thin getters rather than a chain of algorithms. The MST
rule constrains the composed TYPES, not every view.

**A getter that reads nothing but `configuration` belongs in
`configSlotViews.ts`**, which the chain composes as one
`.views(configSlotViews)` link. The line between the two files is what the
getter reads: any OTHER model member and it stays in the chain, where `self` is
the model so far. `collapseGroupRows` and `showOutline` are slot reads that
stayed for that reason. The docs generator follows the link
([ADR-073](../../../../agent-docs/architecture-decision-records/adr-073-delegated-member-blocks-are-followed.md));
before it did, this move silently deleted 33 rows from the model page.

## Rules

Each is a section of
[reference/LINEAR_ALIGNMENTS_DISPLAY.md](../../../../agent-docs/reference/LINEAR_ALIGNMENTS_DISPLAY.md),
which has the why — read that section before changing what it covers.

- Which getter decides what a setting invalidates
- A split segment's color is framed by the chains on screen
- A lane, not a group key
- Six grouping questions, and they are not one object
- Four row caps, and only two are an affordance
- Read height vs track height
- Hit-testing: the mark's `enabled` is the hit gate too
- Context menu: build items from the id, not the feature
- Layout and draw paths
- Reaching into the arc band
