// Re-exported from the published @jbrowse/capture, so the figure generator,
// the browser tests and outside scripts share one meaning of "finished
// rendering". See website/docs/agents_capture.md.
export {
  PENDING_DISPLAYS,
  assemblyFromSession,
  delay,
  describeDisplays,
  displayCensusInPage,
  displayPainted,
  displaySettled,
  encodeSessionSpec,
  findChromeExecutable,
  isBrowserConsoleNoise,
  sessionSpecQuery,
  trackIdsFromSession,
  waitForAppReady,
  waitForAppSettled,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForFrame,
  waitForJBrowseReady,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForSelectorAttributed,
  waitForSession,
  waitForViewPhases,
} from '@jbrowse/capture'

export { BASE_CHROME_ARGS } from './chromeArgs.ts'
export { createSecureTestServer, createTestServer } from './server.ts'
export { DESKTOP_VIEWPORT, smokeExamplesSite } from './examplesSmoke.ts'
export { measureDemoHeights } from './examplesDemoHeights.ts'
export {
  checkDemoAboveFold,
  checkDemoHeights,
  checkPluginTookEffect,
  checkRingsPainted,
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
  findOrphanDocs,
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
} from './docLinks.ts'
export type { Verdict } from './reviewVerdicts.ts'
export type { VerdictRouteOptions } from './reviewServer.ts'
export type {
  ReviewBundle,
  ReviewBundleHost,
  ReviewBundleOptions,
} from './reviewBundle.ts'
