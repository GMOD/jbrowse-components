// The run's CLI, the thresholds its gates and reports judge by, and the paths
// it reads and writes.
//
// IMPORTING THIS PARSES process.argv, and `--help` exits the process, so only
// the generator's own modules import it. Everything else reads
// `screenshot-specs.ts`.
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
    // the changed-file list, one path per line, instead of asking git, which
    // gets a shallow CI checkout's diff wrong
    'changed-from': { type: 'string' },
    // stop before capturing anything when the app build is behind the checkout
    'strict-build': { type: 'boolean', default: false },
    // capture against a stale local build instead of rebuilding it first
    'allow-stale': { type: 'boolean', default: false },
  },
})

// undefined when absent; an unparsable value exits, since `--concurrency 4x`
// falling back to the default would read as the flag having worked
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
// A stale local build is rebuilt before capturing, since a figure drawn by last
// week's app is wrong in ways no diff gate sees. --allow-stale skips the
// rebuild; --strict-build exits instead, for an app behind --port that this
// run cannot rebuild.
export const strictBuild = values['strict-build']
export const allowStale = values['allow-stale']
export const filterTokens = parseFilterTokens(filter)
// A filtered run names its specs, so it means them. The diff gate keeps a sweep
// from rewriting the corpus over antialiasing jitter, but on a named spec it
// keeps stale text, since a renamed label moves well under the threshold.
export const forceCommit = force || filterTokens.length > 0
// Text-heavy specs drift ~0.2% from headless Chrome's sub-pixel glyph jitter;
// 0.5% absorbs that and still lets a new legend or a moved element through.
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
// At least 1, so `--concurrency 0` can't skip every render spec and exit 0.
// --check defaults to serial, where a busy machine can't pass for a flaky spec.
// Before calling a spec flaky, look for a fixed pixel in its actions.
export const CONCURRENCY = Math.max(
  1,
  optNum('concurrency', values.concurrency) ?? (headed || check ? 1 : 2),
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
      --strict-build      Exit before capturing if the app is behind the
                          checkout. A local build behind it is otherwise
                          rebuilt first; an app behind --port is reported
      --allow-stale       Capture against a stale local build instead of
                          rebuilding it

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
// jb2export runs from source, so a local edit to products/jbrowse-img/src
// shows at once; its @jbrowse/* imports come from their built esm/.
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
// Per pid and suffix, so concurrent workers and a --check run's two captures
// never share a path.
export function tempPath(prefix: string, name: string, suffix = '') {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${name.replaceAll('/', '_')}${suffix}.png`,
  )
}
