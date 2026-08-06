For a dashboard or report where the page — not the view — should own scroll and
zoom, a small inline plugin overrides the view model's `scrollTo` and `zoomTo`
with no-ops. JBrowse plugins can wrap any state-model action, so this needs no
change to the embedded component; register it through the `plugins` option.

The lock covers wheel zoom and click-drag side-scroll and leaves the rest of the
view interactive. See [inline plugins](../plugins/#with-inline-plugins) for the
general pattern.
