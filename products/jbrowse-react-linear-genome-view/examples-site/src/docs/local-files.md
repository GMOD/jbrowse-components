Register an index under its sibling name, such as `peaks.bed.gz.tbi`: the
adapter asks for it by that name. `createLinearGenomeView`'s `addLocalFiles`
adds files to a view that is already up. In a notebook,
[`jbrowse-anywidget`](https://github.com/GMOD/jbrowse-anywidget) wraps this as
`add_local_file(path)`.
