`useCreateViewState` comes from `@jbrowse/react-app2` on this page, because the
session in the linear view package holds exactly one view and a synteny view
holds two. Each row is an ordinary linear genome view, so `TrackStack` draws it,
and the synteny view sets the same width on both rows.
