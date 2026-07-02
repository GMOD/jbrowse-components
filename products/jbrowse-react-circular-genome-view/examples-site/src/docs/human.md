A complete real-world example on hg19: HG002 PacBio structural-variant calls
(breakend-only VCF from GIAB) opened on first paint. The VCF is fetched directly
over HTTP range requests; no server-side component is required.

Circular views shine for SV-style data because chromosome-spanning breakends
render as chords across the circle, making whole-genome rearrangements visible
at a glance. For the surrounding `createViewState` embed setup, see the
[minimal example](../volvox/); for the config slots, see
[VcfTabixAdapter](https://jbrowse.org/jb2/docs/config/vcftabixadapter/) and
[VariantTrack](https://jbrowse.org/jb2/docs/config/varianttrack/).
