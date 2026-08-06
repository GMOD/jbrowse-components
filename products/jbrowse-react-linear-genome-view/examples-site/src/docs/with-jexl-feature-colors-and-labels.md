JBrowse evaluates a `jexl:` expression per feature with `feature` in scope, so
color and label can both come from the feature's own attributes with no plugin
code. Here `color` reads strand and `labels.name` rewrites the displayed text:

```js
displayDefaults: {
  color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
  labels: { name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'" },
}
```

These ride the same
[`displayDefaults` shorthand](../feature-colors-and-labels/#with-track-color-shorthand),
landing on the track's
[`LinearBasicDisplay`](https://jbrowse.org/jb2/docs/config/linearbasicdisplay/).
The [jexl callbacks guide](https://jbrowse.org/jb2/docs/config_guides/jexl/) has
the full function and variable vocabulary.
