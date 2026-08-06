// Desktop screenshots are produced by a SEPARATE generator —
// products/jbrowse-desktop/test/screenshots.ts, a Selenium + Electron run —
// rather than by generate-screenshots.ts. They have no web spec, so the review
// UI needs this list to tell them apart from genuinely hand-captured figures;
// without it every one of them is mislabelled "manual", which is the label that
// means "no generator can reproduce this, re-shoot it by hand".
//
// Its own module, small as it is, so that desktopFigures.test.ts can import it
// and check it against that generator's FIGURES list. screenshot-review-lib.ts —
// its only consumer — reads `import.meta.dirname`, which jest's CJS transform
// cannot parse, so anything reachable from there is unreachable from a test.
// Same split, for the same reason, as figure-store.ts vs figure-paths.ts.
//
// Extensionless, because the review UI keys cards on figure names; the desktop
// generator lists the same figures with their `.png`. The test normalizes.
export const desktopAutogenNames = new Set([
  'desktop-landing',
  'desktop-available-genomes',
  'desktop-open-genome-steps',
  'desktop-available-genomes-steps',
  'desktop-add-track-steps',
  'desktop-cli-config',
  'desktop-blat-search',
  'desktop-blat-results',
  'desktop-ispcr',
  'desktop-ispcr-results',
])
