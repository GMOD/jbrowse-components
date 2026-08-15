import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// A hand-written arg type on `execute` drops the handles — 18 of 32 named
// neither stopToken nor statusCallback, and four methods really did lose them.
//
// A source scan because TypeScript cannot express the rule: narrowing an object
// parameter to a SUBSET of its properties is contravariantly SOUND, so moving
// `execute` to a property of function type would not catch it (and would be an
// ABI break). An unannotated parameter is TS7006 — TS does not contextually
// type a derived method's parameters from the base.
const ROOTS = ['packages', 'plugins', 'products', 'example-plugins']

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

// the optional `<…>` matches a base generic over its own name — the three
// rename-region ones. They declare no `execute`, so they fall out below; the
// group is here so a generic base that DOES declare one is scanned rather than
// skipped.
const PARAMETERIZED_CLASS =
  /\bclass\s+\w+\s*(?:<[^>]*>)?\s+extends\s+RpcMethodType\w*</

const EXECUTE_PARAM = /async\s+execute\s*\(\s*\w+\s*:\s*([^,)]+)/

test('every parameterized RPC method takes the full RpcExecuteArgs', () => {
  const offenders = ROOTS.flatMap(root =>
    sourceFiles(path.join(repoRoot, root)),
  )
    .map(full => ({ rel: path.relative(repoRoot, full), full }))
    .filter(({ full }) => {
      const source = readFileSync(full, 'utf8')
      if (!PARAMETERIZED_CLASS.test(source) || !EXECUTE_PARAM.test(source)) {
        return false
      }
      // `includes`, not `startsWith`: an intersection that ADDS to
      // RpcExecuteArgs still receives all of it, which is what this checks. The
      // one class that did (a base generic over its name, which cannot resolve
      // the conditional and intersected what its body needed) is gone, so
      // nothing in the tree relies on the looseness today.
      return !EXECUTE_PARAM.exec(source)?.[1]!.includes('RpcExecuteArgs<')
    })
    .map(({ rel }) => rel)

  expect(offenders).toEqual([])
})

// regexes over source rot silently; a scan that matches nothing still passes
test('the scan actually reaches the RPC methods', () => {
  const scanned = ROOTS.flatMap(root => sourceFiles(path.join(repoRoot, root)))
    .filter(full => {
      const source = readFileSync(full, 'utf8')
      return PARAMETERIZED_CLASS.test(source) && EXECUTE_PARAM.test(source)
    })
    .map(full => path.relative(repoRoot, full))

  // one pin per root that holds RPC methods, so a scan that stops crossing
  // package boundaries fails rather than quietly shrinking
  expect(scanned.length).toBeGreaterThan(30)
  expect(scanned).toContain('packages/core/src/rpc/methods/CoreGetRegions.ts')
  expect(scanned).toContain('plugins/dotplot-view/src/DiagonalizeDotplotRpc.ts')
})
