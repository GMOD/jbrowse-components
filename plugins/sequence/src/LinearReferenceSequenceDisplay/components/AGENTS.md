The GLSL shaders in sequenceShaders.ts are hand-written and have no WGSL
equivalents. They use simple vertex attributes and individual uniforms, which
would need to be rewritten to use the UBO + texture fetch approach that
naga-compiled GLSL requires.
