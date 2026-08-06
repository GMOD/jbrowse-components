`init` accepts more than trackId strings. A `tracks` entry can be an object
carrying a `displaySnapshot` (initial display state — type, height, score range,
colors) or a `trackSnapshot` (e.g. `pinned: true`), and the view itself takes
`tracklist`, `nav` and `highlight`:

```js
init: {
  loc: 'chr1:11,106,077-11,261,675',
  tracklist: true,                          // open the track selector
  nav: true,                                // keep the nav bar visible
  highlight: ['chr1:11,170,000-11,190,000'],
  tracks: [{ trackId: 'my-track', displaySnapshot: { height: 200 } }],
}
```

This is the embedded form of the "advanced track configuration" session spec
JBrowse Web puts in its [URL params](https://jbrowse.org/jb2/docs/urlparams/).
What a `displaySnapshot` accepts is per display type in the state-model
reference, e.g.
[LinearBasicDisplay](https://jbrowse.org/jb2/docs/models/linearbasicdisplay/)
and
[LinearWiggleDisplay](https://jbrowse.org/jb2/docs/models/linearwiggledisplay/).
