---
name: hic-cohesin-loss-comparison-demo
description: The Hi-C comparison is shown on two cell lines (K562 over GM12878). The canonical treatment-against-control picture is cohesin loss, Rao 2017's HCT116 RAD21-mAC with and without auxin, where loops and domains vanish; it needs a hosted copy that answers range requests.
---

# A cohesin-loss demo for the Hi-C comparison

`hic/observed_control` shows K562 over GM12878 at BCR-ABL1: a translocation
and amplicons, differences between two genomes. What observed/control was built
for is a condition against its control on one genome, and cohesin loss is the
clearest case: degrading RAD21 in HCT116 erases loop domains while
compartments strengthen, so the comparison track should draw the loop corners
and domain edges blue beside a sharper checkerboard.

- **Data.** Rao et al. 2017 (GEO GSE104334) deposited `.hic` files for
  HCT116 RAD21-mAC untreated and auxin-treated. The 4DN data portal and its
  open S3 bucket may host copies; either way the server must answer range
  requests, as `jbrowse-hosted-data` requires.
- **Shape.** Add both maps and their comparison to `test_data/config_demo.json`
  beside the GM12878/K562 group, a figure at a locus with strong loops, and a
  sentence in the user guide's "Comparing two conditions" section.
- **Hosting.** If no copy answers range requests, copy the pair to
  jbrowse.org's demo bucket (`agent-docs/reference/HOSTING.md`).
