Regions can be rendered reversed (3'→5'), which is essential for viewing genes
on the negative strand or for laying out synteny-style comparisons. There are
two ways in, shown here on two views.

**Imperatively**, the view exposes a
[`horizontallyFlip()`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-horizontallyflip)
action on `session.view`, reachable via a `ref` on `<LinearGenomeView>` — useful
for custom toolbar buttons or keyboard shortcuts:

```js
ref.current?.session.view.horizontallyFlip()
```

**Declaratively**, append `[rev]` to a locstring passed to `navToLocString` (or
to `init.loc`) to open already flipped; the flip happens as part of navigation:

```js
init={{ loc: 'ctgA:1,000..5,000[rev]' }}
```

To flip only some regions in a multi-region view, see
[mixing orientations](../with-multiple-displayed-regions-flipped/).
`horizontallyFlip` and the rest of the view's actions are listed in the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
