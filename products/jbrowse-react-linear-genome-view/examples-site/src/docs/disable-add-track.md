By default users can add their own tracks through the UI. Pass the
`disableAddTracks` prop to hide the **+ Add track** button for a locked-down
embed.

This also disables the on-the-fly track-creation features that depend on that
flow, such as sequence-search and multi-wiggle tracks. Users can still toggle
the tracks you provided on and off; they just can't introduce new ones.
