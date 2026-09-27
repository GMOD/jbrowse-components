---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the coverage and wiggle figures the clip strip (ADR-183) changes, and one spec wait the submenu fix of 2026-09-27 should let go of."
---

## Open

- **Reshoot the coverage and wiggle figures with a cut bar.** The clip strip
  (ADR-183) marks every bin the 0.99 quantile cut, so any figure with a spike
  in view gained a red strip on it; nothing was reshot, ada being down.
- **Drop `alignments_sort_by_base`'s `waitForAppSettled` and confirm the
  submenu stays.** The spec waits for the read's rows before opening
  "SNP/Mismatch" because the panel shut when they landed. The 2026-09-27
  reading: the rows land below the hit row, the menu grows, and MUI moves the
  paper back into the viewport, so a different row slides under the resting
  pointer and its mouseenter reads as the pointer leaving. `CascadingMenu` now
  ignores a mouseenter at the pointer's last position (pinned in
  `CascadingMenu.test.tsx`), which covers that and rows landing above; the
  shot without the wait is what confirms it was the cause.
