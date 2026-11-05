# plugins/wiggle

Rules and their rationale:
[reference/WIGGLE_DISPLAY.md](../../../agent-docs/reference/WIGGLE_DISPLAY.md) —
read the section before changing what it covers. Scale/axis/score machinery is
`packages/wiggle-core`, shared with other plugins.

- **Land a rendering change in three places**: the Slang shader, its Canvas2D
  painter in `WIGGLE_MARKS`, and `renderSvg.tsx`.
- **Keep the plots on their own shaders** rather than render-core's marks
  (ADR-227 says when to reconsider), sharing a render-core kernel where both
  compute the same thing.
