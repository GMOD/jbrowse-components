The GLSL shaders in this directory are hand-written rather than auto-generated
from the WGSL sources in `../wgsl/`. The naga-compiled GLSL (in `generated/`)
uses uniform buffer objects (`layout(std140)`) and texture-based instance data
(`texelFetch`) for data passing, while the hand-written shaders use simple
vertex attributes (`in`) and individual `uniform` declarations. The WebGL
renderer (`WebGLRenderer.ts`) is built around the attribute-based approach, so
the generated shaders aren't compatible without also rewriting the renderer's
buffer setup.
