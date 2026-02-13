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
}
`

export const SEQUENCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`
