// The readiness waits, the session-spec encoding and the Chrome launch flags are
// not internal to this repo: an agent driving a hosted JBrowse from its own
// script needs exactly them, so they live in the published @jbrowse/capture and
// are re-exported here. One home, so a change to what "finished rendering" means
// reaches the figure generator, the browser tests and the outside world at once.
// See website/docs/agents_capture.md.
export {
  BASE_CHROME_ARGS,
  PENDING_DISPLAYS,
  SANDBOX_CHROME_ARGS,
  delay,
  displayById,
  displayPainted,
  displaySettled,
  encodeSessionSpec,
  findChromeExecutable,
  hasAppReadyMarker,
  isBrowserConsoleNoise,
  isPageBusyInPage,
  readInstrumentation,
  sessionSpecQuery,
  waitForAppReady,
  waitForAppSettled,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForJBrowseReady,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForQuietPeriod,
  waitForSession,
  waitForViewPhases,
} from '@jbrowse/capture'

export { createTestServer } from './server.ts'
export { DESKTOP_VIEWPORT, smokeExamplesSite } from './examplesSmoke.ts'
export { measureDemoHeights } from './examplesDemoHeights.ts'
export {
  checkDemoAboveFold,
  checkDemoHeights,
  checkPluginTookEffect,
  checkSessionUrlRoundTrip,
  checkTextContrast,
  checkTrackIsShown,
} from './examplesChecks.ts'
export {
  checkExamplesSiteDocLinks,
  writeExamplesSiteDemoHeights,
} from './examplesSiteCli.ts'
export {
  buildDocIndex,
  findBrokenCrossLinks,
  findBrokenDocLinks,
  findLongDescriptions,
  findLongDocs,
  findLongPages,
  findMissingDocs,
  runExamplesSiteChecks,
  suggestDocLinks,
} from './docLinks.ts'
export {
  hashFile,
  isVerdictStale,
  loadReport,
  saveReport,
  updateReport,
} from './reviewVerdicts.ts'
export {
  createVerdictRoutes,
  parseNameBody,
  parseVerdictBody,
  readBody,
  sendJson,
} from './reviewServer.ts'
export {
  buildReviewPage,
  createReviewBundle,
  serveReviewBundle,
} from './reviewBundle.ts'

export type { TestServerOptions } from './server.ts'
export type { SmokeOptions } from './examplesSmoke.ts'
export type { DemoHeightOptions } from './examplesDemoHeights.ts'
export type {
  BrokenCrossLink,
  BrokenLink,
  DocPage,
  DocSuggestion,
  LongProse,
  MissingDoc,
} from './docLinks.ts'
export type { Verdict } from './reviewVerdicts.ts'
export type { VerdictRouteOptions } from './reviewServer.ts'
export type {
  ReviewBundle,
  ReviewBundleHost,
  ReviewBundleOptions,
} from './reviewBundle.ts'
