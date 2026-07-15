By default users can add their own tracks through the UI. Pass
`disableAddTracks` to hide the **+ Add track** button for a locked-down embed:

```jsx
<LinearGenomeView
  assembly={assembly}
  tracks={tracks}
  init={{ loc: 'ctgA:1,000..5,000' }}
  disableAddTracks
/>
```

This also disables on-the-fly track-creation features that depend on the
add-track flow, such as sequence-search tracks and multi-wiggle tracks. Users
can still toggle the tracks you provided on and off; they just can't introduce
new ones.

`disableAddTracks` is one of several embed props documented in the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/).
