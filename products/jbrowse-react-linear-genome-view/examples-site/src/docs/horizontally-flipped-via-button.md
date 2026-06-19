Toggle the view's orientation imperatively — useful for custom toolbar buttons
or keyboard shortcuts. The view exposes a `horizontallyFlip()` action on
`session.view`:

```js
state.session.view.horizontallyFlip()
```

For opening already-flipped, append `[rev]` to a
[locstring](../horizontally-flipped-via-locstring/) instead. To flip only some
regions in a multi-region view, see
[mixing orientations](../with-multiple-displayed-regions-flipped/).
