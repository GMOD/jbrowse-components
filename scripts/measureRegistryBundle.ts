/**
 * What does the RPC worker avoid downloading by stubbing the UI half of the
 * plugin ABI?
 *
 * ADR-128's worker split rests on that number and it lived only in
 * EAGER_BUNDLE.md prose, measured by hand in the era of the deleted
 * `workerNamespaceNames.ts`. This bundles both of jbrowse-web's generated
 * registries for real and writes the result to registryBundleSizes.json, which
 * the docs quote and CI re-checks.
 *
 *   pnpm measure-registry-bundle            re-measure and rewrite the file
 *   pnpm measure-registry-bundle --check    fail if the committed file is stale
 *
 * **Evaluation, not download.** Every `import()` stays external, and what is
 * counted is the modules esbuild keeps once it has tree-shaken: the set each
 * realm evaluates before the first plugin's module scope runs, with a
 * `lazy(() => import(…))` component out. That is the right basis here, because
 * the claim the split makes is about what the worker *evaluates*: a stub exists
 * so a plugin's module-scope read succeeds without the worker pulling
 * react-dom. It is the wrong basis for a download figure, which is what
 * scripts/measureChromeBundle.ts measures instead, and that file's header says
 * why the two differ.
 *
 * **Kept, not reached.** The worker imports a rendering module's data names by
 * name, and `sideEffects: false` prunes the rest of that module's graph. A walk
 * over the metafile's import edges counts the pruned graph too, and reports
 * nearly all of the main thread's rendering stack in the worker.
 *
 * `uiKb` counts the whole rendering stack, not the four specifiers
 * `generateReExports.ts` classifies on: emotion and stylis arrive under
 * @mui/material/styles rather than by being named, and the question here is
 * bytes, not whether a module renders.
 *
 * The worker's residual is the ADR's stated exemption. `ui/theme.ts` imports
 * `createTheme` from @mui/material/styles and every renderer reads the theme,
 * so @mui/system and emotion ride into the worker with it. That is the trade
 * ADR-128 took deliberately over marking every theme reader as UI.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import esbuild from 'esbuild'

const root = path.resolve(import.meta.dirname, '..')
const outFile = path.join(root, 'scripts', 'registryBundleSizes.json')
const args = new Set(process.argv.slice(2))

const UI =
  /^(@mui\/|@emotion\/|@floating-ui\/|react-dom|stylis|react-transition-group)/

function packageOf(file: string) {
  const i = file.lastIndexOf('node_modules/')
  if (i < 0) {
    return undefined
  }
  const parts = file.slice(i + 'node_modules/'.length).split('/')
  return parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!
}

const lazyImportsExternal: esbuild.Plugin = {
  name: 'lazy-imports-external',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args =>
      args.kind === 'dynamic-import'
        ? { path: args.path, external: true }
        : undefined,
    )
  },
}

async function measure(entry: string) {
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    target: 'esnext',
    logLevel: 'error',
    outdir: path.join(root, 'scripts'),
    plugins: [lazyImportsExternal],
  })
  const { inputs, outputs } = result.metafile
  const output = Object.values(outputs).find(
    o =>
      o.entryPoint &&
      path.resolve(root, o.entryPoint) === path.join(root, entry),
  )
  if (!output) {
    throw new Error(`${entry}: esbuild reported no output for the entry point`)
  }
  const evaluated = Object.entries(output.inputs)
    .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
    .map(([file]) => file)
  let bytes = 0
  let uiBytes = 0
  for (const file of evaluated) {
    const { bytes: size } = inputs[file]!
    bytes += size
    if (UI.test(packageOf(file) ?? '')) {
      uiBytes += size
    }
  }
  return { bytes, uiBytes, modules: evaluated.length }
}

const main = await measure('products/jbrowse-web/src/reExports.generated.ts')
const worker = await measure(
  'products/jbrowse-web/src/workerReExports.generated.ts',
)
const kb = (n: number) => Math.round(n / 1024)

const sizes = {
  main,
  worker,
  mainKb: kb(main.bytes),
  mainUiKb: kb(main.uiBytes),
  workerKb: kb(worker.bytes),
  workerUiKb: kb(worker.uiBytes),
  uiSavedKb: kb(main.uiBytes - worker.uiBytes),
}
const serialized = `${JSON.stringify(sizes, null, 2)}\n`
const summary = `registry evaluated on load: main ${sizes.mainKb} KB (${sizes.mainUiKb} KB of it rendering stack), worker ${sizes.workerKb} KB (${sizes.workerUiKb} KB), so the stub split keeps ${sizes.uiSavedKb} KB of rendering stack out of the worker`

if (args.has('--check')) {
  const prev = JSON.parse(readFileSync(outFile, 'utf8')) as typeof sizes
  // Exact bytes move with every dependency bump, so an equality check would be
  // a permanent nuisance. What must not drift is the claim the docs make, so
  // this gates on the rounded KB the prose actually shows.
  const drifted = (
    ['mainKb', 'mainUiKb', 'workerKb', 'workerUiKb', 'uiSavedKb'] as const
  ).filter(k => sizes[k] !== prev[k])
  if (drifted.length) {
    console.error(
      `registryBundleSizes.json is stale on ${drifted.join(', ')}:\n${drifted
        .map(k => `  ${k}: committed ${prev[k]}, measured ${sizes[k]}`)
        .join('\n')}\nRun \`pnpm autogen\` and commit the result.`,
    )
    process.exit(1)
  }
  console.log('registryBundleSizes.json is current')
} else {
  writeFileSync(outFile, serialized)
  console.log(`${summary}\nwrote ${path.relative(root, outFile)}`)
}
