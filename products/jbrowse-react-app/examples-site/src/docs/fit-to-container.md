The app root defaults to `height: 100vh`. To put it inside your own layout —
below a header, in a dashboard panel, in a split pane — set
`--jbrowse-app-height` on any ancestor:

```css
.my-jbrowse-container {
  --jbrowse-app-height: 100%;
}
```

The variable feeds `height: var(--jbrowse-app-height, 100vh)` on the app root.
For `100%` to resolve, **the container must have a definite height** — here a
flex child with `minHeight: 0` fills what's left below the header. A fixed
`600px` works too and needs no sized ancestor.
