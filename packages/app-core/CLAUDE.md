# @jbrowse/app-core

- **`@jbrowse/react-app2/styles.css` is empty and stays exported.** Embedders
  import it; deleting it breaks every one of them (ADR-057).
- **Products key `<App>` on `session.id`**, so a session swap remounts the
  container and `session` is constant for a mounted one. Undo (`applySnapshot`
  on the same node) keeps the id and does not remount.
