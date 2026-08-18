// What do the four module-level `WeakMap`s in `util/mstUtils.ts` buy over the
// `getParent` walk they memoize?
//
//   node packages/core/benches/parentWalkMemo.bench.ts
//   node packages/core/benches/parentWalkMemo.bench.ts --rounds=15
//
// Written to answer "can these come out". They cannot: over five runs the walk
// costs 13.6-17.6x what the memoized lookup does, and 3.2-3.7x even inside a
// reaction. That is unlike the three parent-walk and array-index memos this repo
// HAS removed (positionIndex.ts, tooltipUtils.ts, tracks.ts) — each of those was
// keyed on a temporary, or defeated a MobX subscription, and none was measured
// to be buying anything.
//
// The last arm isolates where that time goes, because the obvious suspicion is
// the predicate: `isSessionModel` is two `in` checks, and `in` on a MobX proxy
// goes through the `has` trap. It is not the predicate — one `in` is ~70ns
// against a 6.2-7.0us bare walk with no predicate at all, so ~1% of it. The cost
// is MST's own `getParent` and `isAlive`, six hops of each. A cheaper predicate
// is not the alternative to the memo.
//
// Read that last arm's ABSOLUTES loosely and its ratio strictly: it runs last
// and absorbs the earlier arms' GC, which moved it 2x across runs (the trap the
// sequential-timing entry in REJECTED_IDEAS.md describes). The `in`-to-walk ratio
// held at ~1% throughout, which is the claim it is here to settle.
//
// WHAT IS MODELLED: the walk and the memo, over a tree with the real SHAPE —
// session > views[] > view > tracks[] > track > displays[] > display, which is
// six `getParent` hops because every MST array in between is a node of its own.
//
// WHAT IS NOT: node count. The walk's cost is linear in DEPTH, not in how many
// siblings a level has, which the sweep below confirms — 1 node and 200 nodes
// cost the same per call.
import { getParent, hasParent, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 7,
)

const Display = types.model('Display', {
  id: types.identifier,
  height: 100,
})

const Track = types.model('Track', {
  id: types.identifier,
  displays: types.array(Display),
})

const View = types.model('View', {
  id: types.identifier,
  tracks: types.array(Track),
  bpPerPx: 10,
})

const Session = types.model('Session', {
  rpcManager: types.optional(types.frozen(), {}),
  configuration: types.optional(types.frozen(), {}),
  views: types.array(View),
})

// `util/types/index.ts`'s own, transcribed so the bench does not pull the
// package's import graph in for two property checks.
function isSessionModel(thing: unknown) {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'rpcManager' in thing &&
    'configuration' in thing
  )
}

function findParentThatIs(node: IAnyStateTreeNode) {
  let currentNode = getParent<IAnyStateTreeNode>(node)
  while (isAlive(currentNode)) {
    if (isSessionModel(currentNode)) {
      return currentNode
    }
    if (hasParent(currentNode)) {
      currentNode = getParent<IAnyStateTreeNode>(currentNode)
    } else {
      break
    }
  }
  throw new Error('no session model found!')
}

const cache = new WeakMap<IAnyStateTreeNode, IAnyStateTreeNode>()

function cachedFindParent(node: IAnyStateTreeNode) {
  const cached = cache.get(node)
  if (cached && isAlive(cached)) {
    return cached
  }
  const result = findParentThatIs(node)
  cache.set(node, result)
  return result
}

function buildTree(tracksPerView: number, displaysPerTrack: number) {
  return Session.create({
    views: [
      {
        id: 'view1',
        tracks: Array.from({ length: tracksPerView }, (_, t) => ({
          id: `track${t}`,
          displays: Array.from({ length: displaysPerTrack }, (_, d) => ({
            id: `track${t}-display${d}`,
          })),
        })),
      },
    ],
  })
}

function collectDisplays(session: ReturnType<typeof buildTree>) {
  const out: IAnyStateTreeNode[] = []
  for (const view of session.views) {
    for (const track of view.tracks) {
      for (const display of track.displays) {
        out.push(display)
      }
    }
  }
  return out
}

function time(fn: () => void) {
  const samples: number[] = []
  for (let r = 0; r < rounds; r++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  return {
    median: samples[Math.floor(samples.length / 2)]!,
    min: samples[0]!,
    max: samples.at(-1)!,
  }
}

const ITERATIONS = 200_000

console.log(
  `rounds=${rounds}, ${ITERATIONS.toLocaleString()} lookups per round`,
)
console.log()

for (const [tracks, displays] of [
  [1, 1],
  [20, 1],
  [100, 2],
] as const) {
  const session = buildTree(tracks, displays)
  const nodes = collectDisplays(session)
  // warm the memo so the cached arm is measured on its hit path
  for (const n of nodes) {
    cachedFindParent(n)
  }

  const walk = time(() => {
    for (let i = 0; i < ITERATIONS; i++) {
      findParentThatIs(nodes[i % nodes.length]!)
    }
  })
  const memo = time(() => {
    for (let i = 0; i < ITERATIONS; i++) {
      cachedFindParent(nodes[i % nodes.length]!)
    }
  })

  console.log(
    `${tracks} track(s) x ${displays} display(s) = ${nodes.length} nodes`,
  )
  for (const [name, r] of [
    ['walk', walk],
    ['memo', memo],
  ] as const) {
    console.log(
      `  ${name.padEnd(6)} median ${r.median.toFixed(1).padStart(7)}ms  ` +
        `${((r.median / ITERATIONS) * 1e6).toFixed(1).padStart(6)}ns/call  ` +
        `(min ${r.min.toFixed(1)} max ${r.max.toFixed(1)})`,
    )
  }
  console.log(
    `  ratio  walk/memo = ${(walk.median / memo.median).toFixed(2)}x\n`,
  )
}

// Inside a reaction every `in` on a hop also subscribes the reaction to that
// key's `has` atom, which the memo skips along with the walk.
{
  const session = buildTree(20, 1)
  const nodes = collectDisplays(session)
  for (const n of nodes) {
    cachedFindParent(n)
  }
  const REACTIONS = 20_000
  const tracked = (fn: (n: IAnyStateTreeNode) => unknown) =>
    time(() => {
      for (let i = 0; i < REACTIONS; i++) {
        autorun(() => {
          fn(nodes[i % nodes.length]!)
        })()
      }
    })

  console.log(`inside an autorun (${REACTIONS.toLocaleString()} reactions)`)
  const walk = tracked(findParentThatIs)
  const memo = tracked(cachedFindParent)
  for (const [name, r] of [
    ['walk', walk],
    ['memo', memo],
  ] as const) {
    console.log(
      `  ${name.padEnd(6)} median ${r.median.toFixed(1).padStart(7)}ms  ` +
        `${((r.median / REACTIONS) * 1e6).toFixed(1).padStart(6)}ns/reaction`,
    )
  }
  console.log(`  ratio  walk/memo = ${(walk.median / memo.median).toFixed(2)}x`)
}

// Where the walk's time actually goes — the arm that clears the predicate.
{
  const session = buildTree(1, 1)
  const node = collectDisplays(session)[0]!
  const parent = getParent<IAnyStateTreeNode>(node)
  const per = (fn: () => void) => {
    fn()
    const r = time(() => {
      for (let i = 0; i < ITERATIONS; i++) {
        fn()
      }
    })
    return ((r.median / ITERATIONS) * 1e6).toFixed(0).padStart(6)
  }

  console.log('\nisolating one call:')
  console.log(
    `  bare walk, no predicate         ${per(() => {
      let c = getParent<IAnyStateTreeNode>(node)
      while (isAlive(c)) {
        if (!hasParent(c)) {
          break
        }
        c = getParent<IAnyStateTreeNode>(c)
      }
    })} ns`,
  )
  console.log(
    `  getParent                       ${per(() => {
      getParent(node)
    })} ns`,
  )
  console.log(
    `  isAlive                         ${per(() => {
      isAlive(node)
    })} ns`,
  )
  // consumed into a sink so the `in` is not an unused expression, to lint and to
  // whatever V8 would do with a result nothing reads
  let sink = 0
  console.log(
    `  'rpcManager' in <non-session>   ${per(() => {
      sink += 'rpcManager' in (parent as object) ? 1 : 0
    })} ns`,
  )
  if (sink < 0) {
    throw new Error('unreachable')
  }
}
