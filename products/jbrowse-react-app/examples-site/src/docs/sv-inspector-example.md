`SvInspectorView` pairs a spreadsheet of structural variants with a circular
view, so clicking a row highlights the variant's breakend loci in the circular
view. It uses the same `init` shape as the
[spreadsheet view](#spreadsheet-example):

```js
{
  type: 'SvInspectorView',
  init: {
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  },
}
```

Like every view type, this is declared as a `defaultSession.views` entry. See
[Linear synteny view](../comparative-views/#synteny-example) for the general
pattern. The fields `init` accepts come from the
[SvInspectorView model docs](https://jbrowse.org/jb2/docs/models/svinspectorview/).
