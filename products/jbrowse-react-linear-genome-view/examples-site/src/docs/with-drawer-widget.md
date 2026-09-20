Open the track selector with `view.tracklist` rather than calling
`activateTrackSelector` on the built engine: the launch waits for the view to
resize around the drawer before navigating. Without `height`, an open drawer
bounds the view to `drawerViewHeight`, `'100vh'` by default.
