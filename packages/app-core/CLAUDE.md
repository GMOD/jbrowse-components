# @jbrowse/app-core

- **Treat `session` as constant inside a mounted `<App>`**: products key it on
  `session.id`, so a session swap remounts. Undo (`applySnapshot` on the same
  node) keeps the id and does not remount.
