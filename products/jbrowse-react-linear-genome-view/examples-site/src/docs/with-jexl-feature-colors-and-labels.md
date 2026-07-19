JBrowse evaluates `jexl:` expressions per feature, with the `feature` in scope.
The same mechanism drives both feature **color** and feature **labels**, so you
can color and re-label features from their own attributes with no extra UI or
plugin code. `color` reads a CSS color, `labels.name` reads the displayed text:

```js
displayDefaults: {
  // color by strand
  color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
  // label with the feature's name and type
  labels: { name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'" },
}
```

This uses the same
[`displayDefaults` object shorthand](../feature-colors-and-labels/#with-track-color-shorthand).
JBrowse routes the settings to the track's
[`LinearBasicDisplay`](https://jbrowse.org/jb2/docs/config/linearbasicdisplay/),
whose `color` and `labels` config slots accept these callbacks. See the
[jexl callbacks guide](https://jbrowse.org/jb2/docs/config_guides/jexl/) for the
full function/variable vocabulary available in an expression.
