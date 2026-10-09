A file from disk has no URL to append `.bai` to, so JBrowse cannot look for an
index beside it, and the picker takes the data file and its index together. A
`blobId` refers to memory in the open tab, so a reload drops the track and a
saved session cannot reopen it.
