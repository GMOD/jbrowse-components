The GLSL shaders in WebGLFeatureRenderer.ts are hand-written and use simple
vertex attributes and individual uniforms. Naga-compiled GLSL from WGSL sources
was removed because it uses UBOs and texelFetch, which are incompatible with the
vertex-attribute-based WebGL2 renderer.
