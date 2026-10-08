The engine comes from `@jbrowse/react-app2`, because the linear view package's
session holds exactly one view and a synteny view holds two. Each row is an
ordinary linear genome view, so `TrackStack` draws it, and the synteny view fans
its one width out to both rows.
