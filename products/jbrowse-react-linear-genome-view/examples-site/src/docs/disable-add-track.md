By default users can add their own tracks through the UI. Pass the
`disableAddTracks` prop to hide the **+ Add track** button for a locked-down
embed.

This also disables on-the-fly track-creation features that depend on the
add-track flow, such as sequence-search tracks and multi-wiggle tracks. Users
can still toggle the tracks you provided on and off. They just can't introduce
new ones.

`disableAddTracks` is one of several props the embedded `<LinearGenomeView>`
accepts. The
[Embedding JBrowse tutorial](https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/)
shows the component in a full example.
