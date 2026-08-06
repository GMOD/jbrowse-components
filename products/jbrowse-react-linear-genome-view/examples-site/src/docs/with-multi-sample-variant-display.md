A multi-sample VCF renders one row per sample, grouped and colored by sample
metadata. The metadata comes from a samples TSV on the adapter
(`samplesTsvLocation`): first column the sample name, the rest (`population`,
`phenotype`, …) groupable attributes.

Two things are easy to get wrong:

- `colorBy` is a **config slot**, read once when sources load — put it on the
  display configuration, not on a session
  [`displaySnapshot`](../session-setup/#with-init-advanced).
- a track opens its **first** configured display, so
  `LinearMultiSampleVariantDisplay` has to come first in `displays` for opening
  the track by `trackId` to land on it.

Reference:
[VcfTabixAdapter](https://jbrowse.org/jb2/docs/config/vcftabixadapter/),
[LinearMultiSampleVariantDisplay](https://jbrowse.org/jb2/docs/config/linearmultisamplevariantdisplay/).
The
[1000 Genomes SVs tutorial](https://jbrowse.org/jb2/docs/tutorials/sv_multisamples/)
works through population SVs and a family trio end to end.
