`rows.color` is a config setting, read once when sources load, so it goes in
`displayDefaults`, which lands on the display's config, rather than on the
`view.tracks` entry.
