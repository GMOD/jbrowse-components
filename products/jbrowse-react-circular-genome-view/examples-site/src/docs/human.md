HG002 PacBio structural-variant calls on hg19 (breakend-only VCF from GIAB),
opened on first paint. The VCF is fetched directly over HTTP range requests, so
no server-side component is required, and chromosome-spanning breakends render
as chords across the circle.

For the surrounding embed setup, see the [minimal example](../volvox/); for the
config slots, see
[VcfTabixAdapter](https://jbrowse.org/jb2/docs/config/vcftabixadapter/) and
[VariantTrack](https://jbrowse.org/jb2/docs/config/varianttrack/).
