/**
 * What does a display's status chrome actually cost?
 *
 * The "bring your own overlays" story rests on a number, and a number in prose
 * rots. This bundles the two chrome entry points for real and writes the result
 * to chromeBundleSizes.json, which the docs read and CI re-checks. Nobody hand
 * measures and nobody hand edits.
 *
 *   pnpm measure-chrome-bundle            re-measure and rewrite the file
 *   pnpm measure-chrome-bundle --check    fail if the committed file is stale
 *
 * Write-by-default with a `--check` verify mode is the shape every generator in
 * this repo has, which is what lets `pnpm autogen` own it: the fix for a stale
 * file in CI is the same `pnpm autogen` that fixes every other one.
 *
 * What is being compared is the *chrome layer only*: both entries pull the same
 * render-lifecycle hook and the same display-phase logic, so the delta is the
 * overlay set and nothing else. Renderers are not in here at all, and neither
 * is any display, because `RenderingComponent` is lazy in every plugin.
 *
 * React and MobX are external because an embedder already has them. Everything
 * else is bundled, which is the honest question: what does adding this to my
 * app download.
 *
 * **Download, not first paint.** There is no `splitting: true` below, so esbuild
 * emits one file per entry and inlines every `import()` into it — a lazy chunk
 * counts here exactly like an eager one. That is the right basis for the
 * comparison, since `DisplayChrome`'s Material weight is mostly lazy too and
 * counting only entry chunks scores it 5 KB gzip against the plain set's 20,
 * inverting the result. It is the wrong basis for a critical-path claim, so
 * don't quote these as pre-first-paint numbers: measured with `splitting: true`,
 * the plain entry chunk is 19.5 KB gzip and the tooltip's @floating-ui is a
 * separate 18.5 KB chunk fetched on first hover.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import esbuild from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const chromeDir = path.join(root, 'packages/display-kit/src')
const outFile = path.join(here, 'chromeBundleSizes.json')

// The host app already ships these; counting them would flatter both numbers
// equally and answer a question nobody asked.
const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'mobx',
  'mobx-react',
  'mobx-react-lite',
]

// Three entry points, and they answer three different questions.
//
// `mui` — what JBrowse's own status chrome costs. `DisplayChrome` binds the
// Material components, and every stock display imports it.
//
// `plain` — what a display *written over the base* costs: `DisplayChromeBase`
// takes the overlay set as a prop and imports no toolkit, so pairing it with the
// plain set is the only path that keeps Material out of the bundle rather than
// merely off the screen. It needs a display component of your own.
//
// `seam` — what an embedder adds to their app to mount `DisplayUIProvider` over
// JBrowse's stock displays. The honest figure for the common case, and the one
// the build-your-own landing page quotes: those displays still carry
// `DisplayChrome`, so this is what asking for the plain look *adds*, not what it
// saves.
//
// **`DisplayUIProvider` itself, NOT `export *` over the package.** This was the
// whole barrel until `FloatingLegend` moved in, and that one move nearly doubled
// the number — from 19 to 37 KB gzip — because the legend reaches `makeStyles`
// and so drags emotion in, while nothing an embedder mounts touches it. A figure
// that grows when the package gains a component no consumer of the seam renders
// is measuring the directory, not the seam, and the landing page would have gone
// on quoting it. Anything a host reaches for on purpose (`TrackOverlaySlot`,
// `useTrackControlMenu`) it can measure for itself; this is the default cost.
const displayUi = path.join(root, 'packages/display-ui/src/index.ts')
const inDisplayUi = (file: string) =>
  JSON.stringify(displayUi.replace('index.ts', file))
const variants = {
  mui: `export { default } from ${JSON.stringify(path.join(chromeDir, 'DisplayChrome.tsx'))}`,
  plain: [
    `export { default as DisplayChromeBase } from ${JSON.stringify(path.join(chromeDir, 'DisplayChromeBase.tsx'))}`,
    `export { default as plainChromeOverlays } from ${inDisplayUi('plainChromeOverlays.tsx')}`,
  ].join('\n'),
  seam: `export { default } from ${inDisplayUi('DisplayUIProvider.tsx')}`,
}

async function measure(source: string) {
  const result = await esbuild.build({
    stdin: { contents: source, resolveDir: root, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external,
    write: false,
    // the repo's source imports carry explicit .ts/.tsx extensions, and the
    // workspace packages resolve through their exports maps to src/
    conditions: ['import', 'module', 'browser', 'default'],
    logLevel: 'silent',
  })
  const out = result.outputFiles[0]!.contents
  return { bytes: out.byteLength, gzipBytes: gzipSync(out).byteLength }
}

function kb(bytes: number) {
  return Math.round(bytes / 1024)
}

const measured = {
  mui: await measure(variants.mui),
  plain: await measure(variants.plain),
  seam: await measure(variants.seam),
}

const sizes = {
  // regenerate with `pnpm measure-chrome-bundle --update`; do not hand edit
  mui: measured.mui,
  plain: measured.plain,
  seam: measured.seam,
  savedBytes: measured.mui.bytes - measured.plain.bytes,
  savedGzipBytes: measured.mui.gzipBytes - measured.plain.gzipBytes,
  muiKb: kb(measured.mui.bytes),
  plainKb: kb(measured.plain.bytes),
  seamKb: kb(measured.seam.bytes),
  muiGzipKb: kb(measured.mui.gzipBytes),
  plainGzipKb: kb(measured.plain.gzipBytes),
  seamGzipKb: kb(measured.seam.gzipBytes),
}

const args = new Set(process.argv.slice(2))
const serialized = `${JSON.stringify(sizes, null, 2)}\n`

const summary = [
  `stock chrome (MUI overlays):  ${sizes.muiKb} KB  (${sizes.muiGzipKb} KB gzip)`,
  `base + plain overlays:        ${sizes.plainKb} KB  (${sizes.plainGzipKb} KB gzip)`,
  `saved:                        ${kb(sizes.savedBytes)} KB  (${kb(sizes.savedGzipBytes)} KB gzip)`,
  `DisplayUIProvider (the seam): ${sizes.seamKb} KB  (${sizes.seamGzipKb} KB gzip)`,
].join('\n')

if (args.has('--check')) {
  const committed = readFileSync(outFile, 'utf8')
  const prev = JSON.parse(committed)
  // Exact bytes move with every dependency bump, so an equality check would be
  // a permanent nuisance. What must not drift is the claim the docs make, so
  // this gates on the rounded KB the prose actually shows.
  const drifted = (
    [
      'muiKb',
      'plainKb',
      'seamKb',
      'muiGzipKb',
      'plainGzipKb',
      'seamGzipKb',
    ] as const
  ).filter(k => sizes[k] !== prev[k])
  if (drifted.length) {
    console.error(
      `chromeBundleSizes.json is stale on ${drifted.join(', ')}:\n${drifted
        .map(k => `  ${k}: committed ${prev[k]}, measured ${sizes[k]}`)
        .join('\n')}\nRun \`pnpm autogen\` and commit the result.`,
    )
    process.exit(1)
  }
  console.log('chromeBundleSizes.json is current')
} else {
  writeFileSync(outFile, serialized)
  console.log(`${summary}\nwrote ${path.relative(root, outFile)}`)
}
