Regions can render reversed (3'→5'), which is what you want for a gene on the
negative strand or a synteny-style layout. Two ways in:

- **imperatively**,
  [`view.horizontallyFlip()`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-horizontallyflip)
  through a `ref` — for your own toolbar button or keyboard shortcut;
- **declaratively**, `[rev]` appended to a locstring
  (`init={{ loc: 'ctgA:1,000..5,000[rev]' }}`), so the view opens flipped.

To flip only some regions of a multi-region view, see
[mixing orientations](../flipping-regions/#with-multiple-displayed-regions-flipped).
