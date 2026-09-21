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
 * **Evaluation, not download.** Only `import-statement` edges are followed, so
 * what is counted is the module set each realm evaluates before the first
 * plugin's module scope runs — a `lazy(() => import(…))` component is out. That
 * is the right basis here, because the claim the split makes is about what the
 * worker *evaluates*: a stub exists so a plugin's module-scope read succeeds
 * without the worker pulling react-dom. It is the wrong basis for a download
 * figure, which is what scripts/measureChromeBundle.ts measures instead, and
 * that file's header says why the two differ.
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
 *
 * **No realm evaluates shader text at startup**, and both modes fail naming
 * the import chain if one does. A shader's WGSL and GLSL are reached only
 * through its module's `SOURCE` loaders, which a HAL awaits when it is built;
 * a static edge to one puts the text back into every realm that reaches the
 * importer. The lint rule `noShaderTextImport` refuses that edge in source, and
 * this is the check on the routes it cannot see: a served subpath in an
 * `exports` map, and the product's own worker entry, whose plugin graph is
 * the main thread's `corePlugins.ts` plus the worker's bootstrap.
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

const SHADER_TEXT = /^export const (WGSL_SOURCE|GLSL_VERTEX|GLSL_FRAGMENT) /m

async function evaluatedModules(entry: string) {
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    target: 'esnext',
    logLevel: 'error',
    absWorkingDir: root,
  })
  const { inputs } = result.metafile
  const start = Object.keys(inputs).find(
    f => path.resolve(root, f) === path.join(root, entry),
  )
  if (!start) {
    throw new Error(`${entry}: esbuild reported no input for the entry point`)
  }
  // Breadth first, keeping the importer that reached each module first, so a
  // failure below can print the shortest chain.
  const importer = new Map<string, string | undefined>([[start, undefined]])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    for (const imported of inputs[queue[i]!]?.imports ?? []) {
      if (
        imported.kind === 'import-statement' &&
        inputs[imported.path] &&
        !importer.has(imported.path)
      ) {
        importer.set(imported.path, queue[i])
        queue.push(imported.path)
      }
    }
  }
  return { inputs, importer }
}

function shaderTextChains(importer: Map<string, string | undefined>) {
  return [...importer.keys()]
    .filter(
      file =>
        !file.includes('node_modules/') &&
        SHADER_TEXT.test(readFileSync(path.join(root, file), 'utf8')),
    )
    .map(file => {
      const chain = []
      for (let f: string | undefined = file; f; f = importer.get(f)) {
        chain.unshift(f)
      }
      return chain.join('\n      -> ')
    })
}

async function measure(entry: string) {
  const { inputs, importer } = await evaluatedModules(entry)
  const evaluated = importer.keys()
  let bytes = 0
  let uiBytes = 0
  for (const file of evaluated) {
    const { bytes: size } = inputs[file]!
    bytes += size
    if (UI.test(packageOf(file) ?? '')) {
      uiBytes += size
    }
  }
  return { bytes, uiBytes, modules: importer.size, importer }
}

const { importer: mainImporter, ...main } = await measure(
  'products/jbrowse-web/src/reExports.generated.ts',
)
const { importer: workerImporter, ...worker } = await measure(
  'products/jbrowse-web/src/workerReExports.generated.ts',
)
const WORKER_ENTRY = 'products/jbrowse-web/src/rpcWorker.ts'
const shaderText = [
  ...shaderTextChains(mainImporter),
  ...shaderTextChains(workerImporter),
  ...shaderTextChains((await evaluatedModules(WORKER_ENTRY)).importer),
]
if (shaderText.length > 0) {
  console.error(
    `${shaderText.length} shader text module(s) evaluated at startup, each reached by a static import:\n${shaderText
      .map(chain => `  ${chain}`)
      .join(
        '\n',
      )}\nReach a shader through its <name>.generated.ts, whose SOURCE loads the text when a HAL is built with the pass, and never serve a text module in an exports map.`,
  )
  process.exit(1)
}
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
