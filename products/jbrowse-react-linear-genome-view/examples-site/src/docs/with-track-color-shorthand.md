Per-track appearance (color, height, display mode) is set on a track's
**displays** (the different ways a track can be drawn). Rather than writing out
the full `displays` array, you can list your settings in a `displayDefaults`
**object**. JBrowse works out which display each setting belongs to and applies
it, so you don't have to know the display's type name:

```js
{
  type: 'FeatureTrack',
  trackId: 'volvox_genes_green',
  name: 'Volvox genes',
  assemblyNames: ['volvox'],
  adapter: { /* ... */ },
  // applied to the track's LinearBasicDisplay for you
  displayDefaults: { color: 'green' },
}
```

A `jexl:` expression works the same way for per-feature coloring. See
[jexl colors and labels](../feature-colors-and-labels/#with-jexl-feature-colors-and-labels).
For full control (giving two displays different values, an explicit `displayId`,
or choosing the default display) pass `displays` as the array form instead, per
the [track config guide](https://jbrowse.org/jb2/docs/config_guides/tracks/).
