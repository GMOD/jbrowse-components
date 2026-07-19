Register additional tracks on a running view by calling `addTrackConf` and
`showTrack` from an event handler, not during render:

```js
state.jbrowse.addTrackConf({
  type: 'FeatureTrack',
  trackId: 'my_genes',
  name: 'My Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff.gz',
  },
})
state.session.views[0]?.showTrack('my_genes')
```

The slots available on a track config come from its
[config docs](https://jbrowse.org/jb2/docs/config/) (e.g.
[FeatureTrack](https://jbrowse.org/jb2/docs/config/featuretrack/)), and each
`adapter` type has its own page too (e.g.
[Gff3TabixAdapter](https://jbrowse.org/jb2/docs/config/gff3tabixadapter/)). To
extend the app with new track types, adapters, or renderers rather than just
adding tracks, see [plugins](../plugins/#embedded-plugin).
