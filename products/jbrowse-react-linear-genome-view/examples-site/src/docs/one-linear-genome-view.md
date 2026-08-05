The smallest working embed: one component, three props. `assembly` names the
reference sequence and where to fetch it, `tracks` declares what is available,
and `init` says where to open and which of those tracks to show on first paint.
The component creates and owns its view state — there is no store to set up and
no provider to wrap it in.

`assembly.uri` points at a `.2bit` here; `.fa` with a `.fai`, `.fa.gz` with
`.fai`+`.gzi`, and a `chrom.sizes`-only assembly all work through the same
field. Adapters take the same `uri` shorthand, so a `.gff3.gz` finds its
`.gff3.gz.tbi` without the nested index form being spelled out. `init.loc` is a
1-based locstring, the same thing a user types into the location box.

[Declarative init](../setting-up-the-view/#with-init) is the same call against a
real assembly, covering `refNameAliases`, `chrom.sizes` and CSI indexes.
[useCreateViewState](../setting-up-the-view/#use-create-view-state) is for when
you need to hold the view state yourself.
