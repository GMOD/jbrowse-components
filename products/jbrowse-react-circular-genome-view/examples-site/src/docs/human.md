HG002 PacBio structural-variant calls on hg19 — a breakend-only VCF from GIAB,
opened on first paint. The VCF is fetched over HTTP range requests, so there is
no server-side component, and chromosome-spanning breakends render as chords
across the circle.

For the surrounding setup see the [minimal example](../volvox/); for the config
slots, [VcfTabixAdapter](https://jbrowse.org/jb2/docs/config/vcftabixadapter/)
and [VariantTrack](https://jbrowse.org/jb2/docs/config/varianttrack/).
