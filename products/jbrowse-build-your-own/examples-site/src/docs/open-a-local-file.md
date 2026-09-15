A blob has no URL to append `.bai` to, so JBrowse cannot find an index beside
it: the picker has to take the pair. A `blobId` lives in memory, so a local
track is gone after a reload and means nothing in a saved session.
