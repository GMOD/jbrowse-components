The GLSL shaders in WebGLFeatureRenderer.ts are hand-written. Generated GLSL
from WGSL sources exists in generated/index.ts but is not currently used. The
hand-written shaders use simple vertex attributes and individual uniforms, while
the naga-compiled GLSL uses UBOs (`layout(std140)`) and texture-based instance
data (`texelFetch`), making them incompatible without also rewriting the
renderer's buffer setup.
