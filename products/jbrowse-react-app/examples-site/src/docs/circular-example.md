`CircularView` renders structural variants as arcs around a circular ideogram.
`init` takes a single `assembly` and the `tracks` to show:

```js
{
  type: 'CircularView',
  init: {
    assembly: 'volvox',
    tracks: ['volvox_sv_test'],
  },
}
```

Like every view type, this is declared as a `defaultSession.views` entry — see
[Linear synteny view](../synteny-views/#synteny-example) for the general
pattern. The fields `init` accepts come from the
[CircularView model docs](https://jbrowse.org/jb2/docs/models/circularview/).
