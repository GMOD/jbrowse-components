# plugins/wiggle

Rules and their rationale:
[reference/WIGGLE_DISPLAY.md](../../../agent-docs/reference/WIGGLE_DISPLAY.md) —
read the section before changing what it covers. Scale/axis/score machinery is
`packages/wiggle-core`, shared with six other plugins.

- **A rendering change lands in three places**: the Slang shader (then
  `pnpm gen:shaders`), its Canvas2D painter in `WIGGLE_MARKS`, and
  `renderSvg.tsx`.
- The plots stay on their own shaders rather than render-core's marks; ADR-227
  says when to reconsider. Share a render-core kernel where both compute the
  same thing.
- `MultiQuantitativeTrack/displaySchema.ts` is the whole on-screen difference
  between the two track types (ADR-143, ADR-172).
