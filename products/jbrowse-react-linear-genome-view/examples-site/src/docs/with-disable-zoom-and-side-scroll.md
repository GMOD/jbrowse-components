For a dashboard or report where the page — not the view — should own scroll and
zoom, a small inline plugin overrides the view model's `scrollTo` and `zoomTo`
with no-ops. JBrowse plugins can wrap any state-model action, so this needs no
change to the embedded component; register it through the `plugins` option.

The lock covers wheel zoom and click-drag side-scroll and leaves the rest of the
view interactive — but it is not only a gesture lock. `navTo` and `moveTo` reach
the view through those same two actions, so a locked view also stops responding
to `location` and `navToLocString`: pin its starting scale and offset in a
`defaultSession` instead.

Every header control routes through those two actions too, so the pan arrows,
zoom buttons, zoom slider and search box go inert while still looking live. This
demo sets `hideHeader: true` so they are not offered; the `MiniControls` that
replaces the header keeps two zoom buttons, which stay inert.

If nothing in the view needs to be interactive, don't lock a live one:
[export it to SVG](../export-and-errors/#export-svg), or render one ahead of
time with the [`@jbrowse/img`](https://www.npmjs.com/package/@jbrowse/img) CLI,
and put that image on the page.

See [inline plugins](../plugins/#with-inline-plugins) for the general pattern.
