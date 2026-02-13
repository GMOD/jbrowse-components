export const SEQUENCE_VERTEX_SHADER = `#version 300 es
precision highp float;

// per-instance attributes
layout(location = 0) in vec4 a_rect;  // x (bp offset), y (px), width (bp), height (px)
layout(location = 1) in vec4 a_color; // RGBA normalized from ubyte

uniform float u_offsetPx;
uniform float u_bpPerPx;
uniform float u_canvasWidth;
uniform float u_canvasHeight;

out vec4 v_color;
out vec2 v_uv;
out vec2 v_rectSizePx;

void main() {
  // 6 vertices per instance: 2 triangles forming a quad
  int vid = gl_VertexID % 6;
  // quad corners: 0=BL, 1=BR, 2=TL, 3=TL, 4=BR, 5=TR
  float cx = (vid == 1 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  float cy = (vid == 2 || vid == 3 || vid == 5) ? 1.0 : 0.0;

  float xBp = a_rect.x + cx * a_rect.z;
  float xPx = xBp / u_bpPerPx - u_offsetPx;
  float yPx = a_rect.y + cy * a_rect.w;

  // convert pixel coords to clip space
  float clipX = (xPx / u_canvasWidth) * 2.0 - 1.0;
  float clipY = 1.0 - (yPx / u_canvasHeight) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_color = a_color;
  v_uv = vec2(cx, cy);
  v_rectSizePx = vec2(a_rect.z / u_bpPerPx, a_rect.w);
}
`

export const SEQUENCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_borderWidth;

in vec4 v_color;
in vec2 v_uv;
in vec2 v_rectSizePx;
out vec4 fragColor;

void main() {
  fragColor = vec4(v_color.rgb, 1.0);

  // alpha > 0.999 signals border-eligible (alpha byte = 255)
  if (u_borderWidth > 0.0 && v_color.a > 0.999) {
    float edgeX = min(v_uv.x * v_rectSizePx.x, (1.0 - v_uv.x) * v_rectSizePx.x);
    float edgeY = min(v_uv.y * v_rectSizePx.y, (1.0 - v_uv.y) * v_rectSizePx.y);
    float edge = min(edgeX, edgeY);
    if (edge < u_borderWidth) {
      fragColor = vec4(0.333, 0.333, 0.333, 1.0);
    }
  }
}
`
