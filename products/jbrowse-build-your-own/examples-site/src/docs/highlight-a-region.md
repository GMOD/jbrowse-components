[The page before this one](../search-by-name/) ends by navigating to a search
hit, which is half the job: the reader lands on a window of sequence with
nothing marking what they clicked.

`view.highlight` is the mark, and it is data: an array of
`{refName, start, end, color?, label?}`. `setHighlight(list)` replaces the set,
`addToHighlights(one)` appends, and `createViewState` takes `location` and
`highlight` as top-level options, so an embed can arrive already marked.

## What `getHighlightCoords` knows

It returns `{left, width}`, or `undefined` when the region is nowhere on screen.
Four things live inside it, each a bug that only appears on an awkward input —
the three buttons above:

- it **clips to the displayed regions**, so a highlight running past the end of
  a chromosome is trimmed instead of drawn over the greyed-out end of the
  genome;
- **width has a 3px floor**, so a one-base hit at 40kb of zoom is still findable
  rather than a hundredth of a pixel;
- it is **independent of direction**, so a reversed region never renders a band
  inside-out;
- it **resolves the refName the way the view does**, so a highlight naming
  `chr1` lands on an assembly whose sequence file calls it `1`.

**`left` is in viewport pixels**, already net of `offsetPx` — so bands go in a
plain container, unlike `paddingSpans` and `gridlineTicks`, which are laid out
across every displayed region and need `view.staticBlocksTranslateX` on a
wrapper. `scalebarRefNameLabels` is in the viewport frame too.

`session.highlightsVisible` is session-wide, so read it even if you draw no
control for it. JBrowse re-reveals on _growth_ — `addToHighlights` while the
toggle is off turns it back on rather than dropping the band silently, while
`setHighlight` replacing a one-entry set does not, which is what the buttons
above do. Untick the box, click one, and nothing appears.
