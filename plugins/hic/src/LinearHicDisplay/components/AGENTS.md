The GLSL shaders in WebGLHicRenderer.ts are hand-written and have no WGSL
equivalents. They use simple vertex attributes, individual uniforms, and
texture-based color ramps, which would need to be rewritten to use the UBO +
texture fetch approach that naga-compiled GLSL requires.
