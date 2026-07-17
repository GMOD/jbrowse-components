For dashboard or report layouts where the page (not the view) should own scroll
and zoom, a small plugin can override the view model's `scrollTo` and `zoomTo`
actions with no-ops. JBrowse plugins can wrap any state-model action, so this
needs no changes to the embedded component itself — you register the plugin via
the `plugins` option to `createViewState`.

The lock applies to wheel zoom and click-drag side-scroll while leaving the rest
of the view interactive. See [Using plugins](../plugins/#with-inline-plugins)
for the general inline-plugin pattern this builds on, the
[plugin developer guide](https://jbrowse.org/jb2/docs/developer_guide/) for how
action-wrapping works, and the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
for the `scrollTo`/`zoomTo` actions being overridden.
