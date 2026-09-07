---
name: lut-indexed-colour-for-the-coverage-band-and-the-pileup
description: LUT-indexed colour for the coverage band and the pileup: pack a `uint categoryIndex` per instance and sample `colorRampLut` instead of a packed ABGR
area: rendering-and-displays
---

# LUT-indexed colour for the coverage band and the pileup: pack a `uint categoryIndex` per instance and sample `colorRampLut` instead of a packed ABGR

declined 2026-09-04, at the owner's call, from the GPU
architecture review. It would make a recolour a small texture
write rather than a per-instance lane patch, which is the real payoff. But
recolours are not frequent enough here for that to be a clear win, and
`createInstanceCache` already patches the colour lane without a full repack. It
would also move every colour decision behind a texture sample, which is the one
thing that makes a pass un-liftable to Canvas2D
(`ideas/canvas2d-painter-generation.md` counts four passes stuck there today).
