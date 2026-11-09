`height` keeps the header pinned and scrolls only the tracks, and sizes the
drawer beside the view; without it, an open drawer is the window's height. Open
the track selector with `view.tracklist`, not `activateTrackSelector`: the
launch waits for the view to resize around the drawer before navigating.
