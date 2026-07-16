The embedded view inherits CSS from its host. There's no shadow-DOM isolation in
the default rendering path, so wrapping the component in a styled container
composes normally — borders, margins, and backgrounds all work as you'd expect:

```jsx
<div style={{ border: '4px solid blue', padding: 16 }}>
  <JBrowseLinearGenomeView viewState={state} />
</div>
```

If you need the opposite — guaranteed isolation from a host page's global styles
— render the view inside a [Shadow DOM](../style-isolation/#shadow-dom) instead.
