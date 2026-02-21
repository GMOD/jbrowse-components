The GLSL shaders in WebGLLDRenderer.ts are hand-written and have no WGSL
equivalents. The other variant displays (MultiWebGLVariantDisplay,
MultiWebGLVariantMatrixDisplay) do use naga-compiled GLSL from WGSL sources, but
the LD display uses texture-based color ramps and a different data passing
approach that hasn't been ported to WGSL yet.
