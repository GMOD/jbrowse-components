// Dedicated lazy-load entry for the shared export dialog (owned by
// linear-genome-view). Keeping a local file as the dynamic-import target gives
// the bundler a clean code-split boundary.
export { ExportSvgDialog as default } from '@jbrowse/plugin-linear-genome-view'
