# Dotplot other ideas / deferred work

## Better rendering of very short alignments (dot-like segments)

**Problem**: When `lineWidth` is increased, very short alignments (sub-pixel or
near-zero screen length) render as thin vertical slivers rather than dots. This
is because the degenerate fallback in the vertex shader uses
`normal = vec2(0.0, 1.0)`, so the quad only expands vertically.

**Attempted approach**: Add square end caps by displacing vertices along the
tangent direction by `(t - 0.5) * lineWidth` when `len < lineWidth`. This
makes zero-length segments render as `lineWidth × lineWidth` squares. However,
it produced oddly-shaped polygons that looked off even for normal segments,
so it was reverted.

**Better next steps to explore**:

- **Point sprites**: For segments shorter than some threshold (e.g. `lineWidth`
  in screen pixels), skip the line quad entirely and emit a point sprite
  (`gl_PointSize`) centered on the midpoint. This would give clean circular or
  square dots without touching the line path.

- **Separate instanced draw call for dots**: Split geometry upload into two
  buffers — long segments and short segments — and issue a separate draw call
  for the short ones using `GL_POINTS` or a billboard quad that is always axis-
  aligned (not rotated to the line direction).

- **Round caps via SDF in fragment shader**: Pass the along-tangent distance as
  a second varying (`v_tang_dist`, range -0.5..+0.5 mapped to the cap region)
  and discard fragments outside a circle of radius `lineWidth/2` at each end.
  This gives proper round caps with AA but requires more varying data and
  careful UV setup.
