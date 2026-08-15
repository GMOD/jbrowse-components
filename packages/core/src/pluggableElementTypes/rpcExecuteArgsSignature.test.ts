import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Every parameterized `execute` must declare `RpcExecuteArgs<'ItsKey'>` rather
// than a hand-written arg type, and this is a source scan because **TypeScript
// cannot express the rule at all**.
//
// The tempting diagnosis is bivariance — a method declaration is checked
// bivariantly, so a narrowed parameter passes — and the tempting fix is to move
// `execute` to a property of function type so `strictFunctionTypes` applies.
// That does not work, and it is worth writing down because the fix would be an
// ABI break (`RpcMethodType` is in `abiBaseline.json`; a subclass writing
// `async execute(...)` against a base property is TS2425) bought for nothing.
// Narrowing an object parameter to a SUBSET of its properties is contravariantly
// *sound*: contravariance asks that the base's parameter type be assignable to
// the derived one, and `{a, stopToken?, statusCallback?}` is assignable to
// `{a}`. So a narrowed args type passes under either variance rule. Widening it
// — adding a required field — is what contravariance catches, and that is not
// the mistake anyone makes.
//
// Leaving the parameter unannotated is the other non-answer: TS does not
// contextually type a derived class method's parameters from the base, so it is
// TS7006 implicit-any.
//
// What gets narrowed away is always the same two fields, because they are the
// two an author writing the type out by hand does not think to include — 18 of
// 32 hand-written arg types named neither `stopToken` nor `statusCallback`, and
// the values were arriving on the object the whole time. Four methods had
// genuinely dropped them: GetPileupFeatureDetails and SyntenyResolveMatchingRegion
// each built a fresh `{ lodMode }` opts object for a per-region re-read,
// PileupGetGlobalValueForTag passed the token but not the callback, and
// MultiSampleVariantGetSources called `getSources` with no opts at all, which is
// an uncancellable full scan of every visible region.
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

// Any class extending a parameterized RpcMethodType* base, INCLUDING one that
// passes its own type parameter through (`class DiagonalizeRpcBase<MethodName
// extends string> extends RpcMethodType<MethodName, …>`). Those bases were
// invisible to an earlier version of this that required a quoted key right
// after the `<`, which is how the one place a shared body could drop the
// handles for two registered methods at once went unscanned.
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
      // `includes`, not `startsWith`: a shared base intersects what its body
      // needs onto the derived type (`DiagonalizeExecuteArgs &
      // RpcExecuteArgs<MethodName>`) because the conditional inside
      // RpcExecuteArgs stays deferred while the key is still generic.
      return !EXECUTE_PARAM.exec(source)?.[1]!.includes('RpcExecuteArgs<')
    })
    .map(({ rel }) => rel)

  // the path is the whole diagnostic — the fix is to write the derived type
  expect(offenders).toEqual([])
})

// The scan is worthless if it matches nothing, and its regexes are the kind
// that rot silently against a formatter change or a renamed base. Pin that it
// still sees the real methods.
test('the scan actually reaches the RPC methods', () => {
  const scanned = ROOTS.flatMap(root => sourceFiles(path.join(repoRoot, root)))
    .filter(full => {
      const source = readFileSync(full, 'utf8')
      return PARAMETERIZED_CLASS.test(source) && EXECUTE_PARAM.test(source)
    })
    .map(full => path.relative(repoRoot, full))

  expect(scanned.length).toBeGreaterThan(30)
  expect(scanned).toContain('packages/synteny-core/src/DiagonalizeRpcBase.ts')
  expect(scanned).toContain('packages/core/src/rpc/methods/CoreGetRegions.ts')
})
