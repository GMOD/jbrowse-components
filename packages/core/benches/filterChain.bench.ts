// What a feature display's `filter` list costs in SerializableFilterChain
// against the jexl-strings-only chain it replaced, per feature, over
// SimpleFeatures as the canvas worker admits them. Arms interleaved, min over
// rounds:
//
// - strings, before: the old chain, one jexl context per feature
// - strings: the same expression as a bare string entry
// - expression entry: `{ field: "jexl:…", equal: true }`, what a bare string
//   lifts to through the config
// - field test: `{ field: "score", gt: 5 }`, the same filter with no jexl
//
//   node packages/core/benches/filterChain.bench.ts
//   node packages/core/benches/filterChain.bench.ts --rounds=15 --features=200000
import { performance } from 'node:perf_hooks'

import SerializableFilterChain from '../src/pluggableElementTypes/renderers/util/serializableFilterChain.ts'
import createJexlInstance from '../src/util/jexl.ts'
import { stringToJexlExpression } from '../src/util/jexlStrings.ts'
import SimpleFeature, { buildJexlContext } from '../src/util/simpleFeature.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 9)
const n = arg('features', 100_000)

const jexl = createJexlInstance()
const EXPR = "jexl:get(feature,'score') > 5"

let seed = 7
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const features = Array.from(
  { length: n },
  (_, i) =>
    new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'ctgA',
      start: i * 10,
      end: i * 10 + 5,
      score: Math.floor(rand() * 10),
    }),
)

// SerializableFilterChain.passes as it stood before the list
const oldChain = [stringToJexlExpression(EXPR, jexl)]
function before() {
  let kept = 0
  for (const feature of features) {
    const context = buildJexlContext({ feature })
    if (oldChain.every(expr => expr.eval(context))) {
      kept++
    }
  }
  return kept
}

const through = (chain: SerializableFilterChain) => () => {
  let kept = 0
  for (const feature of features) {
    if (chain.passes(feature)) {
      kept++
    }
  }
  return kept
}

const arms = {
  before,
  strings: through(new SerializableFilterChain({ filters: [EXPR], jexl })),
  expressionEntry: through(
    new SerializableFilterChain({
      filters: [{ field: EXPR, equal: true }],
      jexl,
    }),
  ),
  fieldTest: through(
    new SerializableFilterChain({
      filters: [{ field: 'score', gt: 5 }],
      jexl,
    }),
  ),
}
const best: Record<string, number> = {}
const kept: Record<string, number> = {}
for (let r = 0; r < rounds; r++) {
  for (const [name, run] of Object.entries(arms)) {
    const t0 = performance.now()
    kept[name] = run()
    best[name] = Math.min(best[name] ?? Infinity, performance.now() - t0)
  }
}
if (new Set(Object.values(kept)).size !== 1) {
  throw new Error(`kept differ: ${JSON.stringify(kept)}`)
}
console.log(
  `${n} features, ${kept.before} kept; ns a feature: ${Object.entries(best)
    .map(([name, ms]) => `${name} ${((ms / n) * 1e6).toFixed(0)}`)
    .join(', ')}`,
)
