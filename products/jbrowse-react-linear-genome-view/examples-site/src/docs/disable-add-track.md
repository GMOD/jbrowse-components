`disableAddTracks` hides the **+ Add track** button for a locked-down embed.

It also disables the on-the-fly track-creation features that go through that
flow, such as sequence search and multi-wiggle tracks, and it empties the `File`
menu for a host that asked for one with `menuBar`: **Open track...** and **Open
connection...** are the same affordances by another route, so with both gone the
bar has nothing left to hold and is not drawn.

Users can still toggle the tracks you provided on and off; they just can't
introduce new ones.
