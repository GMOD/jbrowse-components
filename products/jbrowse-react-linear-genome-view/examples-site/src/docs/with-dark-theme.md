Set `palette.mode: 'dark'` on the theme to render in dark mode. JBrowse has been
tuned to look reasonable under both light and dark palettes:

```js
const state = createViewState({
  assembly,
  tracks,
  configuration: {
    theme: { palette: { mode: 'dark' } },
  },
})
```

For overriding individual colors, see the
[custom theme](../theming/#with-custom-theme) example and the
[theming guide](https://jbrowse.org/jb2/docs/config_guides/theme/).
