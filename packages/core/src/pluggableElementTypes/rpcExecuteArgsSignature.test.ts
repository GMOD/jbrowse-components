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

function sourceFiles(dir: string, includeTests = false): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // esm/dist hold built copies of the same sources, node_modules is not ours
      return /^(node_modules|esm|dist|build|coverage)$/.test(entry.name)
        ? []
        : sourceFiles(full, includeTests)
    }
    const isTest = entry.name.endsWith('.test.ts')
    return entry.name.endsWith('.ts') && (includeTests || !isTest) ? [full] : []
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

// a subclass with NO type argument at all
const UNPARAMETERIZED_CLASS = /\bclass\s+\w+\s+extends\s+RpcMethodType\w*\s*\{/

// Leaving the name off is the documented escape hatch, and the problem with it
// is that it is silent: both ends resolve to `unknown` and everything compiles,
// so a method can be entirely unchecked against the registry without anything
// saying so. That is fine for a test double standing in for a method and wrong
// for a real one, and the two are indistinguishable at the type level — which is
// why this is a source scan rather than a type.
test('no shipped RPC method takes the unparameterized escape hatch', () => {
  const offenders = ROOTS.flatMap(root =>
    sourceFiles(path.join(repoRoot, root)),
  )
    .filter(full => UNPARAMETERIZED_CLASS.test(readFileSync(full, 'utf8')))
    .map(full => path.relative(repoRoot, full))

  expect(offenders).toEqual([])
})

// The scan above asserts an ABSENCE, so a regex that matches nothing at all
// passes it forever. The test doubles are the positive control: they take the
// hatch deliberately, so the same pattern must find them once tests are in
// scope.
test('the escape-hatch scan matches the shape it is looking for', () => {
  const doubles = ROOTS.flatMap(root =>
    sourceFiles(path.join(repoRoot, root), true),
  )
    .filter(full => UNPARAMETERIZED_CLASS.test(readFileSync(full, 'utf8')))
    .map(full => path.relative(repoRoot, full))

  expect(doubles).toContain(
    'packages/core/src/pluggableElementTypes/RpcMethodType.test.ts',
  )
  expect(doubles).toContain(
    'packages/core/src/rpc/statusCallbackDuringSerialize.test.ts',
  )
})
