`tracks` is the JBrowse Web `config.json` `tracks` array, so an entry written
this short is what you save to a file and hand to a whole instance. What each
extension resolves to is listed in
[supported file types](https://jbrowse.org/jb2/docs/config_guides/file_types/),
and `jbrowse validate` accepts the form.

The app is the product that holds several assemblies, and that is where
`assemblyNames` stops being implied: JBrowse fills it in only for a config
declaring exactly one. Nothing fills it in for a track added later either — a
config handed to `addTrackConf`, or arriving through `&sessionTracks=`, keeps
the empty list it was built with and belongs to no assembly.

Spell `type` and `adapter` out when the file name does not decide the format — a
`.txt.gz` that is not Pan-UKBB GWAS summary statistics — or when an adapter slot
has to be set. A key written beside `uri` lands on the track rather than inside
the adapter, so `csi: true` for a CSI index needs the full form. `index` is the
exception, for an index that is not the sibling the guess would derive.
