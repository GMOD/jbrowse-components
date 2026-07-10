The app root defaults to `height: 100vh`, filling the browser window. To embed
it inside your own layout — below a header bar, in a dashboard panel, in a split
pane — set the `--jbrowse-app-height` CSS custom property on any ancestor:

```css
.my-jbrowse-container {
  --jbrowse-app-height: 100%;
}
```

```jsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  <header>My app chrome</header>
  <div className="my-jbrowse-container" style={{ flex: 1, minHeight: 0 }}>
    <JBrowse {/* ... */} />
  </div>
</div>
```

The variable feeds `height: var(--jbrowse-app-height, 100vh)` on the app root, so
a value of `100%` makes the app fill its container. For a percentage to resolve,
that container must have a definite height — here the flex child with
`minHeight: 0` fills the space left below the header. A fixed value like
`--jbrowse-app-height: 600px` works too and needs no sized ancestor.
