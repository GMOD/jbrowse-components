The smallest working embed: one component, three props. `assembly` names the
reference sequence and where to fetch it, `tracks` declares what is available,
and `init` says where to open and which of those tracks to show on first paint.

Nothing else is required. The component creates and owns its view state, mounts
the header, ruler and track chrome, and runs the fetch/render lifecycle. There
is no store to set up and no provider to wrap it in.

`assembly.uri` points at a `.2bit` here; `.fa` with a `.fai`, `.fa.gz` with
`.fai`+`.gzi`, and a `chrom.sizes`-only assembly all work through the same
field. Adapters take the same `uri` shorthand, so a `.gff3.gz` finds its
`.gff3.gz.tbi` without the nested index form being spelled out.

`init.loc` is a 1-based locstring, the same thing a user types into the location
box.

## Where to go from here

[Declarative init](../setting-up-the-view/#with-init) is the same call against a
real assembly, and covers `refNameAliases`, `chrom.sizes` and CSI indexes — the
fields that start mattering once you move off a toy genome. It also explains why
`init` behaves like an input's `defaultValue`: it runs once, and re-rendering
with a different `loc` deliberately does not move a view the user has panned.

[useCreateViewState](../setting-up-the-view/#use-create-view-state) is for when
you need to hold the view state yourself, so it survives a parent re-render and
your own code can call navigation actions on it.
