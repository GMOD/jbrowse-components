`offeredTracks` returns the tracks the view can show, the same list the built-in
track selector reads: each assembly's sequence track first, then the tracks
whose assembly and type the view can draw. `view.getTrack` says whether one is
open and `view.toggleTrack` opens or closes it, so a list of checkboxes is all a
track selector of your own needs.
