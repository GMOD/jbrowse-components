Toggle the view's orientation imperatively — useful for custom toolbar buttons
or keyboard shortcuts. The view exposes a
[`horizontallyFlip()`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-horizontallyflip)
action on `session.view`, reachable via a `ref` on `<LinearGenomeView>`:

```js
ref.current?.session.view.horizontallyFlip()
```

For opening already-flipped, append `[rev]` to a
[locstring](../horizontally-flipped-via-locstring/) instead. To flip only some
regions in a multi-region view, see
[mixing orientations](../with-multiple-displayed-regions-flipped/).

`horizontallyFlip` and the rest of the view's actions are listed in the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
