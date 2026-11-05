# LinearAlignmentsDisplay

Rules and their rationale:
[reference/LINEAR_ALIGNMENTS_DISPLAY.md](../../../../agent-docs/reference/LINEAR_ALIGNMENTS_DISPLAY.md)
— read the section before changing what it covers.

- **Put a getter that computes in a sibling module** (`groupLayout.ts`,
  `lanes.ts`, …), leaving the model getter as the memoized adapter, so each pass
  is testable without an MST tree.
- **Put a getter reading only `configuration` in `configSlotViews.ts`, and a
  setter writing only a slot in `configSlotActions`.** One that touches any
  other member stays in the chain (`setCollapseSections` clears height
  overrides).
