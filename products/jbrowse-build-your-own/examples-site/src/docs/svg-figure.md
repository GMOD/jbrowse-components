For a file rather than DOM nodes, skip the components:
`await view.exportSvg({ filename: 'figure.svg' })` downloads one, and
`renderToSvg(view, {})` from `@jbrowse/plugin-linear-genome-view` returns the
markup as a string.
