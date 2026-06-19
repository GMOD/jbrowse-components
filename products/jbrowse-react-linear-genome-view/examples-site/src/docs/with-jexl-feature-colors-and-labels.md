JBrowse evaluates `jexl:` expressions per feature, with the `feature` in scope.
The same mechanism drives both feature **color** and feature **labels**, so you
can color and re-label features from their own attributes with no extra UI or
plugin code — `color` reads a CSS color, `labels.name` reads the displayed text:

```js
displays: {
  // color by strand
  color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
  // label with the feature's name and type
  labels: { name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'" },
}
```

This uses the same [`displays` object shorthand](../with-track-color-shorthand/)
— JBrowse routes the settings to the track's `LinearBasicDisplay`.
