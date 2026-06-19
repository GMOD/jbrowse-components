Regions can be rendered reversed (3'→5'), which is essential for viewing genes
on the negative strand or for laying out synteny-style comparisons.

The simplest way to open flipped is to append `[rev]` to a locstring passed to
`navToLocString` (or to `init.loc`). The flip happens as part of navigation:

```js
state.session.view.navToLocString('ctgA:1,000..5,000[rev]')
```

See also [flipping via a button](../horizontally-flipped-via-button/) for
imperative toggling, and
[mixing orientations](../with-multiple-displayed-regions-flipped/) for
per-region control.
