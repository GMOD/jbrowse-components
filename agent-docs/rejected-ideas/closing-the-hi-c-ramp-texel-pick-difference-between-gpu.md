---
name: closing-the-hi-c-ramp-texel-pick-difference-between-gpu
description: Closing the hi-C ramp texel-pick difference between GPU and CPU
area: performance-and-measurement
---

# Closing the hi-C ramp texel-pick difference between GPU and CPU

up to
half an entry (sampler texel-center convention vs `round(t * 255)`), which is
sub-visible on a 256-entry smooth ramp. Closing it adds machinery for no
effect.
