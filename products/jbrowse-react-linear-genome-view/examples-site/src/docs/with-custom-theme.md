The embedded view accepts a Material-UI-style theme on its `configuration`
block. JBrowse defines four named palette colors (`primary`, `secondary`,
`tertiary`, `quaternary`) that drive most of the chrome (toolbars, buttons,
highlights). The DNA-base colors used in the sequence display are configurable
separately.

```js
const state = createViewState({
  assembly,
  tracks,
  configuration: {
    theme: {
      palette: {
        primary: { main: '#311b92' },
        secondary: { main: '#0097a7' },
      },
    },
  },
})
```

See the [theming guide](https://jbrowse.org/jb2/docs/config_guides/theme/) for
the full set of options, and [dark mode](../theming/#with-dark-theme) for the
built-in dark palette.
