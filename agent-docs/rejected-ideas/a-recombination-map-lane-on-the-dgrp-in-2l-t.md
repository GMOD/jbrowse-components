---
name: a-recombination-map-lane-on-the-dgrp-in-2l-t
description: A recombination-map lane on the DGRP In(2L)t figure
area: tooling-tests-and-docs
---

# A recombination-map lane on the DGRP In(2L)t figure

the map exists and
converts cleanly; it is the *reading* that does not hold up. Comeron's 100 kb
crossover map ships an R6 sheet beside its R5 one
([comeron.lab.uiowa.edu](https://comeron.lab.uiowa.edu/recombination-rates)),
so no liftover is needed. Two things to know before parsing it again: the R5
and R6 sheets are five side-by-side per-arm blocks, and an xlsx omits empty
cells, so reading cells in document order rather than by their column
reference silently drops arms (it read three of five and said nothing). The
hope was that it would explain why the Fst plateau overruns the inversion
breakpoints, the way the deCODE map explains the LCT block's edges. It does
not. On 2L the rate is 2-10 cM/Mb from 1 Mb through ~15 Mb, i.e. high across
the inversion AND its flanks, and only dies from ~15 Mb to the centromere. The
Fst plateau runs 0 to ~14 Mb, so a reader lining the two lanes up sees the two
fall off together and infers that low recombination causes low Fst, which is
backwards. Around Cyp6g1 the map is 1.1-8.5 cM/Mb over adjacent 100 kb bins
with no structure to read against the sweep. The lane would need a paragraph
to stop it being read wrong, which is the test it fails. The parser was
written, used for this measurement and then deleted rather than left with no
caller; rewrite it if a fly figure ever wants an arm-scale recombination lane
for its own sake.
