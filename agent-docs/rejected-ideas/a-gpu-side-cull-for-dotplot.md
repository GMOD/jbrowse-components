---
name: a-gpu-side-cull-for-dotplot
description: A GPU-side cull for dotplot
area: performance-and-measurement
---

# A GPU-side cull for dotplot

not obviously worth it.
`drawDotplotInstances` culls on the CPU and notes 87% of a fetch is offscreen,
but dotplot quads are a few px, so the rasterizer discards them about as
cheaply as a vertex test would. Synteny's `isCulled` earns its place because
its quads span the track.
