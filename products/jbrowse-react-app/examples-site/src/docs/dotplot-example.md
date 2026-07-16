`DotplotView` compares two assemblies as a 2D dotplot. `init.views` lists the
two assemblies; `tracks` lists the synteny tracks. Self-vs-self is allowed:

```js
{
  type: 'DotplotView',
  init: {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
    tracks: ['volvox_fake_synteny'],
  },
}
```

Like every view type, this is declared as a `defaultSession.views` entry — see
[Linear synteny view](../synteny-views/#synteny-example) for the general pattern. The fields
`init` accepts come from the
[DotplotView model docs](https://jbrowse.org/jb2/docs/models/dotplotview/).
