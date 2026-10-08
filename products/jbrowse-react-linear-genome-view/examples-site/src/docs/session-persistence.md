The stored snapshot goes in `session`, not `defaultSession`, because its shape
is only known at runtime, and it restores against the same `assembly` and
`tracks`. The example removes the entry before using it, so a snapshot this
build cannot open fails once rather than on every reload.
