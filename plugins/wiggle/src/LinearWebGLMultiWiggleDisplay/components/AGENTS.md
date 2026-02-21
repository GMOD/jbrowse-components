The GLSL shaders in WebGLMultiWiggleRenderer.ts (MULTI_XYPLOT_VERTEX_SHADER,
MULTI_DENSITY_VERTEX_SHADER, MULTI_LINE_VERTEX_SHADER,
MULTI_WIGGLE_FRAGMENT_SHADER) are hand-written. The single-wiggle display uses
naga-compiled GLSL from WGSL, but these multi-wiggle shaders use simple vertex
attributes and individual uniforms, which would need to be rewritten to use the
UBO + texture fetch approach that naga-compiled GLSL requires.
