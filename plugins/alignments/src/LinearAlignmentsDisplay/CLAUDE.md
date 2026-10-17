# LinearAlignmentsDisplay

Rules and their rationale:
[reference/LINEAR_ALIGNMENTS_DISPLAY.md](../../../../agent-docs/reference/LINEAR_ALIGNMENTS_DISPLAY.md)
— read the section before changing what it covers. Layout stays on the main
thread (ADR-053).

- **A getter that computes goes in a sibling module** (`groupLayout.ts`,
  `lanes.ts`, …), leaving the model getter as the memoized adapter, so each pass
  is testable without an MST tree.
- **A getter reading only `configuration` goes in `configSlotViews.ts`; a setter
  writing only a slot goes in `configSlotActions`.** One that touches any other
  member stays in the chain (`setCollapseSections` clears height overrides).
