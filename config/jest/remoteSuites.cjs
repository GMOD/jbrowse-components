// The suites `pnpm test` leaves to remote CI, for jest.config.js and
// scripts/test-related.ts both:
//
// - jbrowse-web's suites boot the app, except the ones under LOCAL_DIR, which
//   read the schemas the whole plugin set registers, boot nothing, and run
//   locally.
// - A `*.ci.test.*` suite is one whose cost buys nothing at a desk: it needs a
//   tool a dev box may lack, or it is the whole of a slow tier another suite
//   already samples. Its own job, or `pnpm test-ci`, runs it.
const WEB_SUITES = 'products/jbrowse-web/'
const LOCAL_DIR = 'src/schemaTests/'
const CI_ONLY = /\.ci\.test\.(ts|tsx|js|jsx)$/

module.exports = {
  WEB_SUITES,
  LOCAL_DIR,
  CI_ONLY,
  isRemoteOnly: suite =>
    CI_ONLY.test(suite) ||
    (suite.startsWith(WEB_SUITES) && !suite.startsWith(WEB_SUITES + LOCAL_DIR)),
}
