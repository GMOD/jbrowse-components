# Session mixins

- **Merge or list a stored track-config delta through
  `displayForms(pluginManager)`**, which puts each delta display in canonical
  spelling. Without it a bare `mark: "line"` replaces the base's whole `mark`,
  and a retired spelling loses to the base's current one.
- **Hold a trackId in a config editor, never a working copy**
  (`getEditableTrackConfigById`); a held node goes stale on undo and saves the
  undone value back.
