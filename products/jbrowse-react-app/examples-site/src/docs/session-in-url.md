The hash fragment never reaches the server, so a long session cannot fail with
HTTP 414. Only the session travels: the receiving page supplies its own
`assemblies` and `tracks`, and File → New session still returns to
`defaultSession`.
