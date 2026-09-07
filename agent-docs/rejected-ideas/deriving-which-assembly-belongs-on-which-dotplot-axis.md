---
name: deriving-which-assembly-belongs-on-which-dotplot-axis
description: Deriving which assembly belongs on which dotplot axis
area: comparative-and-pangenome
---

# Deriving which assembly belongs on which dotplot axis

there is no
convention to find, and hunting for one has produced reversed code and docs
repeatedly. Tracks are meant to be bidirectionally queryable, so both
orientations are valid and the plot simply transposes. The fixtures actively
disagree: `test_data/config_dotplot.json`'s default session maps X to
`names[1]` while the hpylori figure spec maps X to `names[0]`, and
`detectSwappedAssemblies.ts` exists precisely because either way renders. Call
`dotplotAxesFromRows` (synteny-core); since `166febd5e6` that is the only
place the mapping is written down.
