The GLSL shaders in DotplotRenderer.ts (LINE_VERTEX_SHADER,
LINE_FRAGMENT_SHADER) are hand-written using simple vertex attributes and
individual uniforms. Naga-compiled GLSL from WGSL sources was removed because it
uses UBOs and texelFetch, which are incompatible with the vertex-attribute-based
WebGL2 fallback renderer.
