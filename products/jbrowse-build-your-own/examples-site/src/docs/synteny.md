`useCreateViewState` comes from `@jbrowse/react-app2` on this page, because the
session in the linear view package holds exactly one view and a synteny view
holds two. `SyntenyStack` draws a ribbon band between neighbouring rows. Each
row is an ordinary linear genome view, so the page's `renderRow` hands it to
`TrackStack`, and the synteny view sets the same width on every row.
