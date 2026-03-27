// Shared shader fragments used by both alignments and synteny GPU renderers.
// Keeps GLSL and WGSL picking/passthrough shaders in one place.

// 6-vertex quad corner selection (WGSL).
// vid is the vertex index within a 6-vertex triangle-list quad.
// local_x/local_y: 0.0 or 1.0 selecting the corner.
export const RECT_LOCALS_WGSL = `
  let v = vid % 6u;
  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
`

// Passthrough fragment shader — returns interpolated color unchanged.
export const SIMPLE_FS_WGSL = `
@fragment
fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
`

// Standard vertex output struct for color-only rendering.
export const SIMPLE_VERTEX_OUTPUT_WGSL = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}
`

// GLSL picking fragment shader — encodes a flat float featureId as RGB bytes.
// Expects `flat in float v_featureId;` from the vertex shader.
export const PICKING_FS_GLSL = `#version 300 es
precision highp float;

smooth in vec4 v_color;
flat in float v_featureId;
out vec4 fragColor;

void main() {
  uint id = uint(v_featureId);
  fragColor = vec4(
    float(id & 0xFFu) / 255.0,
    float((id >> 8u) & 0xFFu) / 255.0,
    float((id >> 16u) & 0xFFu) / 255.0,
    1.0
  );
}
`

// WGSL picking fragment shader — encodes featureId as RGB bytes.
// Expects `@location(1) @interpolate(flat) featureId: f32` in the vertex output.
export const PICKING_FS_WGSL = `
@fragment
fn fs_picking(in: VOut) -> @location(0) vec4f {
  let id = u32(in.featureId);
  let r = f32(id & 0xFFu) / 255.0;
  let g = f32((id >> 8u) & 0xFFu) / 255.0;
  let b = f32((id >> 16u) & 0xFFu) / 255.0;
  return vec4f(r, g, b, 1.0);
}
`

// GLSL passthrough fragment shader — returns interpolated color.
export const SIMPLE_FS_GLSL = `#version 300 es
precision highp float;

smooth in vec4 v_color;
flat in float v_featureId;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`
