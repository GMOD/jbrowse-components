A `react-app2` session holds any number of views of any type. Each launches the
same declarative way — a [`views`](../basic-example/) entry with a `type` and an
`init`. `init` is the same shape JBrowse Web serializes into its
`?session=spec-…` [URL parameter](https://jbrowse.org/jb2/docs/urlparams/), so
these examples are the programmatic equivalent of those URLs.

`LinearSyntenyView` puts two linear genome views one above the other with a
ribbon for the synteny features between them (PAF, MUMmer, …). `init` names the
two member assemblies and the track that ties them together.

Fields are per view type under
[docs/models](https://jbrowse.org/jb2/docs/models/) — here
[LinearSyntenyView](https://jbrowse.org/jb2/docs/models/linearsyntenyview/). To
prepare your own alignment, see the
[synteny visualization tutorial](https://jbrowse.org/jb2/docs/tutorials/synteny_visualization/).
