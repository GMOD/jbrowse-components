A session holds what `view` cannot, like a track of its own: `sessionTracks`
adds the long reads, as JBrowse saves a file a user opened. Unlike `tracks`, it
needs `assemblyNames`. Export a session from JBrowse Web with **File → Export
session**. JBrowse drops a `height` or `color` on a session's display node; put
it on the track's `displays` entry.
