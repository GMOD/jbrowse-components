# plugins/wiggle

Rules and their rationale:
[reference/WIGGLE_DISPLAY.md](../../../agent-docs/reference/WIGGLE_DISPLAY.md) —
read the section before changing what it covers. Scale/axis/score machinery is
`packages/wiggle-core`, shared with other plugins.

- **Land a rendering change in two places**: the Slang shader and its Canvas2D
  painter in `WIGGLE_MARKS`, which the SVG export paints through too.
- **Keep the plots on their own shaders** rather than render-core's marks
  (ADR-227 says when to reconsider), sharing a render-core kernel where both
  compute the same thing.
