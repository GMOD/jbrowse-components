---
name: deferring-simplefeature-s-subtree-inflation-to-children
description: Deferring `SimpleFeature`'s subtree inflation to `children()`
area: performance-and-measurement
---

# Deferring `SimpleFeature`'s subtree inflation to `children()`

measured
2026-08-11 and declined, having looked very promising in isolation: **10.9x**
on construction alone, and **1.00–1.06x** once the consumer walks the subtree,
which every renderer does. The construction-only number is the trap — it is
real and it is not what any caller experiences. Removing the *spread* from
`inflateSubfeatures` was the win there and shipped separately (2.03x construct,
1.56x through a render's reads); laziness on top of it buys nothing and would
move subfeature validation out of the constructor and into the middle of a
render. One process per arm, generated GENCODE-shaped corpus.
