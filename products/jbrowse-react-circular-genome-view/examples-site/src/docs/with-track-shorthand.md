A `tracks` entry can be an id and a `uri`. JBrowse reads the track type and the
adapter off the file's extension, derives the index sibling, and takes `name`
from the file name unless the entry gives one — the guess the app's "Add track"
dialog runs, listed per format under
[supported file types](https://jbrowse.org/jb2/docs/config_guides/file_types/).

A circular view draws whichever of a track's displays is a chord display, so
what makes this a ring rather than a row of features is the view it is mounted
in, not anything the track config says.

`assemblyNames` is what the shorthand cannot always supply: this component
stamps on its one `assembly`, and a `config.json` supplies it wherever the file
declares exactly one — but a track handed to `session.addTrackConf` keeps the
empty list it was built with and belongs to no assembly, so name it there. Spell
`type` and `adapter` out when the file name does not decide the format, or when
an adapter slot has to be set, such as `csi: true` for a CSI index.
