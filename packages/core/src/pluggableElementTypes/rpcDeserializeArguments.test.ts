import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Every `RpcMethodType.execute` has to call `this.deserializeArguments`, and
// nothing enforces it at the type level: the worker entry point looks the method
// up and invokes `execute` directly (`product-core/src/rpcWorker.ts`), so an
// `execute` that reads `args` straight through simply skips the step.
//
// What it skips is the blob map — how a `BlobLocation`, a file the user opened
// from their own disk, resolves to a `File` inside the worker realm. Subclasses
// add to it: `RpcMethodTypeWithFiltersAndRenameRegions` rebuilds the
// `SerializableFilterChain` from its on-wire `string[]` there.
//
// It is invisible because the blob map is a module global in the worker, so
// whichever RPC deserialized last leaves one behind and the next method to skip
// this reads *that* one — the right answer, by accident. It goes wrong when the
// inherited map is not the current one: `setBlobMap` replaces wholesale, and a
// worker that died and was re-booted (the pool drops and re-boots the slot)
// starts with none at all. A local-file track then renders all day and renders
// nothing after a GPU hiccup takes a worker with it.
//
// Eleven methods across seven plugins had drifted off it when this was written,
// every primary per-region fetch RPC among them. A test rather than another CI
// step: it costs nothing beyond the run that already exists, and it sits beside
// the contract it is about.
const ROOTS = ['packages', 'plugins', 'products']

// Methods with no adapter config and no locations in their arguments have
// nothing to resolve. Keep this short, and say why.
const EXEMPT: Record<string, string> = {
  'packages/core/src/rpc/methods/CoreFreeResources.ts':
    'frees adapter caches by session id; no locations in its arguments',
}

const repoRoot = path.join(__dirname, '..', '..', '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // esm/dist hold built copies of the same sources, node_modules is not ours
      return /^(node_modules|esm|dist|build|coverage)$/.test(entry.name)
        ? []
        : sourceFiles(full)
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [full]
      : []
  })
}

test('every RPC method deserializes its arguments', () => {
  const offenders = ROOTS.flatMap(root =>
    sourceFiles(path.join(repoRoot, root)),
  )
    .map(full => ({ rel: path.relative(repoRoot, full), full }))
    .filter(({ rel }) => !(rel in EXEMPT))
    .filter(({ full }) => {
      const source = readFileSync(full, 'utf8')
      return (
        // the class declaration, not an import of the base type
        /\bclass\s+\w+\s+extends\s+RpcMethodType\w*\b/.test(source) &&
        /\basync\s+execute\s*\(/.test(source) &&
        !source.includes('this.deserializeArguments(')
      )
    })
    .map(({ rel }) => rel)

  // the path is the whole diagnostic — the fix is one line at the top of
  // `execute`, and if the method really has no locations it goes in EXEMPT
  expect(offenders).toEqual([])
})
