`init` accepts more than trackId strings. Each `tracks` entry can be an object
carrying a `displaySnapshot` (initial display state — type, height, score range,
color scheme) or a `trackSnapshot` (e.g. `pinned: true`), and the view itself
can be configured declaratively with `tracklist`, `nav`, and `highlight`. This
is the embedded equivalent of the session-spec "advanced track configuration"
used in JBrowse Web URL params:

```js
init: {
  assembly: 'hg38',
  loc: 'chr1:11,106,077-11,261,675',
  tracklist: true,                 // open the track selector on load
  nav: true,                       // keep the navigation bar visible
  highlight: ['chr1:11,170,000-11,190,000'],
  tracks: [
    { trackId: 'my-gene-track-id', displaySnapshot: { height: 200 } },
  ],
}
```

For an alignments-specific `displaySnapshot`, see
[initializing an alignments display](../with-init-alignments-display/).
