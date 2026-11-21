---
name: hic-cohesin-loss-comparison-demo
description: The Hi-C comparison is shown on two cell lines (K562 over GM12878); the canonical treatment-against-control picture is cohesin loss, Rao 2017's HCT116 RAD21-mAC with and without auxin, and it needs a hosted copy that answers range requests.
---

# A cohesin-loss demo for the Hi-C comparison

`hic/observed_control` shows K562 over GM12878 at BCR-ABL1: a translocation
and amplicons, differences between two genomes. What observed/control was built
for is a condition against its control on one genome, and cohesin loss is the
clearest case: degrading RAD21 in HCT116 erases loop domains while
compartments strengthen, so the comparison track should draw the loop corners
and domain edges blue beside a sharper checkerboard.

Its compartment half, eigenvectors from juicer_tools drawn as BigWigs, is the
outside-JBrowse tutorial for Hi-C compartments.

- **Data.** Rao et al. 2017 (GEO GSE104334) deposited `.hic` files for
  HCT116 RAD21-mAC untreated and auxin-treated. The 4DN data portal and its
  open S3 bucket may host copies; either way the server must answer range
  requests, as `jbrowse-hosted-data` requires.
- **Shape.** Add both maps and their comparison to `test_data/config_demo.json`
  beside the GM12878/K562 group, a figure at a locus with strong loops, and a
  sentence in the user guide's "Comparing two conditions" section.
- **Hosting.** If no copy answers range requests, copy the pair to
  jbrowse.org's demo bucket (`agent-docs/reference/HOSTING.md`).

## The compartment half, computed outside JBrowse

Rao 2017 reports compartments strengthening after auxin, which gives a page a
figure to reproduce where ENCODE publishes no eigenvector. The tool makes the
vector and JBrowse only draws it:

- **Vector:** `juicer_tools eigenvector KR <hic> <chr> BP 250000 <out>` per
  condition and chromosome. Juicer returns an empty vector below 250 kb
  (`MAX_EIGENVECTOR_ZOOM`), and `-p` does not lift it.
- **Track:** the output is one value per line with no coordinates and `NaN`
  for a masked bin, so the recipe writes each bin's interval from
  chrom.sizes, clips the last bin, drops the `NaN` lines, flips each
  chromosome's sign against gene density and runs `bedGraphToBigWig`.
- **View:** both BigWigs on one pinned scale under the auxin-over-untreated
  observed/control track.

Run the recipe end to end before a page cites it.
