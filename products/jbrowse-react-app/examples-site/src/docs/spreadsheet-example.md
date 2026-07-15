`SpreadsheetView` opens a tabular file (e.g. a VCF) as a sortable, filterable
spreadsheet. `init` takes the `assembly` and a `uri` to the file — note `uri` is
on `init`, not in a track config:

```js
{
  type: 'SpreadsheetView',
  init: {
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.filtered.vcf.gz',
  },
}
```

Like every view type, this is declared as a `defaultSession.views` entry — see
[Linear synteny view](../synteny-example/) for the general pattern. To pair a
spreadsheet with a circular view that highlights breakends, see the
[SV inspector](../sv-inspector-example/). The view's properties and actions are
listed in the
[SpreadsheetView state model](https://jbrowse.org/jb2/docs/models/spreadsheetview/).
