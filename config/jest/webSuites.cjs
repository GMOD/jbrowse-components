// Where jest.config.js and scripts/test-related.ts draw one line: the
// jbrowse-web suites boot the app and run on remote CI, except the ones under
// LOCAL_DIR, which read the schemas the whole plugin set registers, boot
// nothing, and run with `pnpm test`.
module.exports = {
  WEB_SUITES: 'products/jbrowse-web/',
  LOCAL_DIR: 'src/schemaTests/',
}
