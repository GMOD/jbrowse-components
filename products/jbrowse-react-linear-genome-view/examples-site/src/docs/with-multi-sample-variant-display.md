A multi-sample VCF (one genotype column per sample) can render each sample as a
row, grouped and colored by sample metadata. Provide the metadata via a samples
TSV on the adapter. Its first column is the sample name, and the remaining
columns (`population`, `phenotype`, …) become groupable attributes:

```js
adapter: {
  type: 'VcfTabixAdapter',
  vcfGzLocation: { uri: 'volvox.sv.vcf.gz' },
  index: { location: { uri: 'volvox.sv.vcf.gz.tbi' } },
  samplesTsvLocation: { uri: 'volvox.sv.samples.tsv' }, // name<TAB>population
}
```

Set `colorBy` on the display **configuration** (not a session
[`displaySnapshot`](../session-setup/#with-init-advanced), `colorBy` is a config
slot, read once when sources load) and list `LinearMultiSampleVariantDisplay`
first in the track's `displays` array. A track opens its first configured
display by default, so opening it by `trackId` shows the multi-sample display
with `colorBy` already applied:

```js
displays: [
  {
    type: 'LinearMultiSampleVariantDisplay',
    displayId: 'volvox_multisample_sv-LinearMultiSampleVariantDisplay',
    colorBy: 'population', // groups + colors samples by this column on load
  },
]
```

See [VariantTrack](https://jbrowse.org/jb2/docs/config/varianttrack/),
[VcfTabixAdapter](https://jbrowse.org/jb2/docs/config/vcftabixadapter/)
(including `samplesTsvLocation`), and
[LinearMultiSampleVariantDisplay](https://jbrowse.org/jb2/docs/config/linearmultisamplevariantdisplay/)
([state model](https://jbrowse.org/jb2/docs/models/linearmultisamplevariantdisplay/)).
The [1000 Genomes SVs tutorial](https://jbrowse.org/jb2/docs/tutorials/sv_multisamples/)
works through population SVs and a family trio in a multi-sample display end to
end.
