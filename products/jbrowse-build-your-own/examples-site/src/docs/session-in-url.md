A decoded session goes in `session`, not `view`. The link contains the session,
and the page that opens the link passes `assembly` and `tracks` from its code.
`JBrowseLinearGenomeView` takes a session the same way:
[Session in the URL](https://jbrowse.org/storybook/lgv/session-in-url/).
