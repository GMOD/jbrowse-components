A session holds what `view` cannot. Here it carries a track of its own: the
`tracks` prop lists only the genes, and `sessionTracks` adds the long reads, the
way a user's opened file is saved and restored. A session track names its
`assemblyNames`, which `tracks` fills in for you.

To get a session, build the view in JBrowse Web and use **File → Export
session**. A config slot such as `height` or `color` written on a session's
display node is dropped without a word. Put it on the track's `displays` entry
instead.
