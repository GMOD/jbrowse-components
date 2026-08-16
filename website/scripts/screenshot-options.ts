// Everything the run is configured by: the CLI surface, the thresholds the diff
// gate and the reports are judged against, and the paths a capture reads from
// and writes to.
//
// IMPORTING THIS PARSES process.argv, and `--help` exits the process. That is
// fine for the generator and its own modules, which are only ever loaded by a
// run — but it is why nothing else (check-specs.ts, the gallery link builder)
// should import it. Those read `screenshot-specs.ts` instead.
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { parseFilterTokens } from './filter-tokens.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Strict parsing rejects unknown flags (a typo'd `--fliter` fails loudly
// instead of silently screenshotting every spec) and accepts `--x=y` or `--x y`.
const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    headed: { type: 'boolean', default: false },
    // multiple, so `--filter a --filter b` unions rather than keeping only b
    filter: { type: 'string', short: 'f', multiple: true },
    exact: { type: 'boolean', default: false },
    // point the proxy at an already-running app server instead of build/
    port: { type: 'string' },
    localport: { type: 'string' },
    concurrency: { type: 'string' },
    // render with the Firefox backend instead of Chrome (some WebGL/molstar
    // content rasterizes more cleanly under headless Firefox than headless
    // Chrome's swiftshader)
    firefox: { type: 'boolean', default: false },
    // overwrite every PNG, bypassing the content-stable diff gate
    force: { type: 'boolean', default: false },
    // render each spec twice and fail if the two captures drift past threshold,
    // without touching committed PNGs — a CI guard against newly-flaky specs
    check: { type: 'boolean', default: false },
    // fraction-of-pixels diff below which a re-render keeps the committed PNG
    'diff-threshold': { type: 'string' },
    // narrow the run to specs a change could plausibly have moved
    affected: { type: 'boolean', default: false },
    // the smallest set of specs that still puts every declared type on screen
    cover: { type: 'boolean', default: false },
    since: { type: 'string' },
    // take the changed-file list from a file (one path per line) instead of
    // asking git — a CI runner already knows the diff of the PR it is building,
    // and computing it again from a shallow checkout gets it wrong
    'changed-from': { type: 'string' },
  },
})

// Parse a numeric CLI option, returning undefined when absent. A present but
// unparsable value exits rather than falling back to the default: the same
// reason parseArgs is strict about unknown flags — `--diff-threshold .5%` or
// `--concurrency 4x` otherwise runs the whole suite under the default and
// reports success, which is indistinguishable from the flag having worked.
function optNum(name: string, raw: string | undefined) {
  if (raw === undefined) {
    return undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.error(`--${name} expects a number, got "${raw}"`)
    process.exit(1)
  }
  return n
}

const { headed, filter, exact, force, check, firefox, affected, cover, since } =
  values
export { headed, exact, check, firefox, affected, cover, since }
// the changed-file list --affected reads instead of asking git
export const changedFrom = values['changed-from']
export const filterTokens = parseFilterTokens(filter)
// A filtered run names its specs, so it means them: the content-stable diff gate
// below exists to keep an unfiltered sweep from rewriting 288 PNGs over
// antialiasing jitter, and applying it to a spec the author just asked for is
// how a figure gets "regenerated" and silently keeps its stale text (a rename or
// a shortened label moves well under 0.5% of a 3000px figure). Rendering is
// deterministic, so forcing here rewrites an unaffected figure byte-identically
// and git sees nothing.
export const forceCommit = force || filterTokens.length > 0
// With dithering disabled (see optimizePng) flat-UI specs re-render byte-for-
// byte, but text-heavy specs still drift ~0.2% from headless-Chrome sub-pixel
// glyph-positioning jitter (ruler/track labels, SNP ticks render a hair
// differently run-to-run). 0.5% absorbs that with ~2.5x margin while still
// letting a genuine edit — a new legend, a moved element — through. Raise it
// further for timing/remote-data specs.
const DEFAULT_DIFF_THRESHOLD = 0.005
const DEFAULT_LOCAL_PORT = 3334
// Captures are hidpi, so an image pixel is half a CSS pixel.
export const DEVICE_SCALE_FACTOR = 2
// Blank page background under a figure's content, in image pixels, past which
// the run reports the spec's viewportHeight as stale. ~50 CSS px is below what
// reads as a framing choice and above the few px of margin every capture has.
export const SLACK_WARN_PX = 100
// CSS px of page below the viewport, past which the capture is cutting off
// content rather than framing it. A few px is normal rounding; a clipped track
// row is tens.
export const CLIP_WARN_PX = 8
export const diffThreshold =
  optNum('diff-threshold', values['diff-threshold']) ?? DEFAULT_DIFF_THRESHOLD
export const externalPort = optNum('port', values.port)
export const servePort =
  optNum('localport', values.localport) ?? DEFAULT_LOCAL_PORT
// Math.max(1, …) so `--concurrency 0` can't spin up zero workers and silently
// skip every render spec while still exiting 0.
//
// --check defaults to serial so a drift report has one fewer confound: with four
// browsers sharing CPU and network, "this spec is flaky" and "the machine was
// busy" are indistinguishable. It is explicitly NOT a fix for flakiness —
// multiwig/addtrack has gone both 0.000% and 0.7% serially, and that one is
// still unexplained. Pass --concurrency for wall-clock.
//
// alignments_sort_by_base used to head this list at 17% drift in roughly half of
// serial runs, and it turned out not to be render nondeterminism at all: its
// right-click was a hand-measured pixel, so WHICH read the menu opened on
// depended on how the pileup happened to pack that run — and after the spec's
// window was narrowed from 108bp to 31bp without the number being redone, the
// pixel wasn't even on the SNP any more. Anchoring the click to the locus
// (scripts/locusAnchor.ts) took it to 0.000% across six renders. Worth
// remembering before calling a figure irreducibly flaky: a fixed coordinate in
// its action chain is a likelier cause than the renderer.
export const CONCURRENCY = Math.max(
  1,
  optNum('concurrency', values.concurrency) ?? (headed || check ? 1 : 4),
)

const HELP = `Render website screenshots from scripts/screenshot-specs.ts.

Usage: pnpm generate-screenshots [options]

Options:
  -h, --help              Show this help and exit
  -f, --filter <a,b,c>    Only render specs whose name matches any token
                          (substring match; see --exact). Repeatable; every
                          occurrence's tokens are unioned. Implies --force: a
                          run that names its specs means them
      --exact             Make --filter tokens match spec names exactly
      --force             Overwrite every PNG, bypassing the content-stable
                          diff gate (already implied by --filter)
      --check             Render each spec twice and report specs that drift
                          past the threshold; commits nothing
      --firefox           Render with the Firefox backend instead of Chrome
      --headed            Run a visible browser (defaults --concurrency to 1)
      --concurrency <n>   Browsers to run at once (default: 4; 1 if --headed or
                          --check, where parallelism reads as spec flakiness)
      --diff-threshold <f>  Pixel-diff fraction below which a re-render keeps
                          the committed PNG (default: ${DEFAULT_DIFF_THRESHOLD})
      --affected          Only render specs a change since --since could have
                          moved (see screenshot-impact.ts). Narrows; does NOT
                          imply --force, and intersects with --filter
      --cover             Only render the smallest set of specs that still puts
                          every declared type on screen (~22 of 329). A
                          correctness gate, not a staleness check: it proves
                          every type still launches and paints, and says nothing
                          about whether a figure is out of date
      --since <ref>       Git ref --affected diffs the working tree against
                          (default: HEAD, i.e. uncommitted work)
      --changed-from <f>  Read --affected's changed-file list from a file (one
                          path per line) instead of asking git
      --port <n>          Proxy to an app server already running on this port
                          instead of serving products/jbrowse-web/build
      --localport <n>     Port to serve/proxy on (default: ${DEFAULT_LOCAL_PORT})

Examples:
  pnpm generate-screenshots
  pnpm generate-screenshots --filter lgv_pileup,dotplot
  pnpm generate-screenshots --check --filter dotplot
  pnpm generate-screenshots --force
  pnpm generate-screenshots --affected
  pnpm generate-screenshots --affected --since origin/main
`

if (values.help) {
  console.log(HELP)
  process.exit(0)
}

export const repoRoot = path.resolve(__dirname, '..', '..')
export const buildPath = path.resolve(
  repoRoot,
  'products',
  'jbrowse-web',
  'build',
)
export const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
export const outDir = path.resolve(__dirname, '..', 'static', 'img')
// jb2export (the @jbrowse/img CLI) renders the products/jbrowse-img/README
// example images straight to PNG via React SSR — no browser involved, so
// CliSpecs bypass the puppeteer pipeline entirely and land here instead of
// outDir. Run from source with plain `node --experimental-strip-types` (not the
// npm-installed `jb2export` binary) so a local edit to products/jbrowse-img/src
// is reflected immediately — its src is pure .ts, so node strips it in place.
// Its @jbrowse/* deps come from their built esm/ (see jbrowse-img's resolve.ts),
// so a plugin change needs `pnpm build` before it shows up in a figure.
export const jbrowseImgDir = path.resolve(repoRoot, 'products', 'jbrowse-img')
export const jbrowseImgOutDir = path.join(jbrowseImgDir, 'img')
export const jb2exportBin = path.join(jbrowseImgDir, 'src', 'bin.ts')
// Prebuilt UMD of the embedded LGV component, used by `mode:'embedded'` specs.
// Built by `pnpm --filter @jbrowse/react-linear-genome-view2 build:webpack`.
export const EMBED_UMD_PATH = path.resolve(
  repoRoot,
  'products',
  'jbrowse-react-linear-genome-view',
  'dist',
  'react-linear-genome-view.umd.production.min.js',
)
// Build a per-process temp PNG path for a spec, sanitizing '/' in the name and
// tagging with the pid (and an optional suffix) so concurrent workers and the
// two captures of a --check run never collide on one path.
export function tempPath(prefix: string, name: string, suffix = '') {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${name.replaceAll('/', '_')}${suffix}.png`,
  )
}
