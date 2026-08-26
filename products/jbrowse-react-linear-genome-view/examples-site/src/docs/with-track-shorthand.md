The `tracks` prop takes the same entries a `config.json` does, and the shortest
of them is an id and a `uri`. The guess behind it is the one the app's "Add
track" dialog runs — what each extension resolves to is listed in
[supported file types](https://jbrowse.org/jb2/docs/config_guides/file_types/).

`assemblyNames` is the key worth knowing about. This component stamps on the
assembly it was given, and a `config.json` supplies it wherever the file
declares exactly one assembly. Nothing implies it for a track handed to
`session.addTrackConf` or arriving through `&sessionTracks=`: that one keeps the
empty list it was built with, belongs to no assembly, and appears in no track
selector.

Spell `type` and `adapter` out when the file name does not decide the format — a
`.txt.gz` that is not Pan-UKBB GWAS summary statistics — or when an adapter slot
has to be set. A key written beside `uri` lands on the track rather than inside
the adapter, so `csi: true` for a CSI index needs the full form. `index` is the
exception, for an index that is not the sibling the guess would derive.
