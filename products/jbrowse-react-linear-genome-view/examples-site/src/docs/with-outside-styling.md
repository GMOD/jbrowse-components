The embedded view inherits CSS from its host. There's no shadow-DOM isolation in
the default rendering path, so wrapping the component in a styled container
composes normally:

```jsx
<div style={{ border: '4px solid blue', padding: 16 }}>
  <JBrowseLinearGenomeView viewState={state} />
</div>
```

If you need the opposite (guaranteed isolation from a host page's global styles),
render the view inside a [Shadow DOM](../theming/#shadow-dom) instead.
