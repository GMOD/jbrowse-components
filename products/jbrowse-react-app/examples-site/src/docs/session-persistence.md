Open a view or a track, then reload: the app comes back as you left it. The
stored snapshot goes in `session`, which restores it over the config's
`defaultSession`. The example removes the entry before using it, so a snapshot
this build cannot open fails once rather than on every reload.
