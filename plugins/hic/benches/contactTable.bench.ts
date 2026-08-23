// What does the first hover after a fetch cost, and what is paying for it?
//
//   node plugins/hic/benches/contactTable.bench.ts
//   node plugins/hic/benches/contactTable.bench.ts --only=4500000 --rounds=15
//
// `contactLookup.ts` builds its index synchronously inside `HicBody`'s render,
// off `model.hitTest`, the first time the cursor lands on the track after each
// fetch. A Chrome profile of a pan-with-cursor-on-track measured 217ms of
// main-thread self time there. The index's own comment sizes a full-width
// triangle at ~300k contacts and two `resolutionBias` steps at ~4.5M.
//
// THREE ARMS, in the order they were written.
//
// R — the original: an open-addressed hash keyed on the recovered
//   `(regionPair, bin1, bin2)` tuple, with `binAt(data, i, regionIdx, axis)`
//   re-destructuring the payload and re-indexing `regions` on each of its two
//   calls per contact.
// H — the same hash, with everything constant across a `pairRuns` entry hoisted
//   to the run, the way the worker's pack loop already hoists its own.
// T — what ships: a uniform grid over the packed positions. The keys were the
//   expensive part, not the table. Keying on bins meant inverting the worker's
//   pack for all N contacts purely so a cursor and a stored cell could be
//   reduced to the same thing; a tile does that straight off the position,
//   which both already have.
//
// WHAT IS NOT MODELLED. The `WeakMap` around the build (once per payload) and
// the probe itself. T moves work into the probe — it scans a 2x2 tile
// neighbourhood and recovers the bins of the few contacts there, where the hash
// went straight to one slot — so the probe is timed separately below rather
// than left out of the comparison. It runs per mousemove, not per fetch.
//
// Fixture is one forward region and one pairRun: a single LGV region with the
// cursor on it, the shape the profiled stall had. A reversed region changes
// which branch the recovery takes, not how much any arm reloads per contact.
//
// Four rules from agent-docs/reference/BENCHMARKING.md: separate drivers per
// arm, a control that is the baseline declared twice, min of interleaved
// rounds, identity before timing — here that all three indexes answer the same
// point queries, since T's structure is not comparable field by field.
// `--only` exists because looping fixtures through shared arm objects
// contaminates every fixture after the first.
export {}

const STRIDE_WORDS = 3

interface Region {
  dataXStart: number
  dataXEnd: number
  combinedOffset: number
  reversed: boolean
}
interface Run {
  region1Idx: number
  region2Idx: number
  start: number
  end: number
}
interface Payload {
  instances: Float32Array
  numContacts: number
  binWidth: number
  regions: Region[]
  pairRuns: Run[]
}

function capacityFor(numContacts: number) {
  let capacity = 1
  while (capacity < numContacts * 1.5) {
    capacity *= 2
  }
  return capacity
}

// ---------------------------------------------------------------- ARM R
function getInstancePositionR(f32: Float32Array, i: number, c: number) {
  return f32[i * STRIDE_WORDS + c]!
}
function mirrorUR(region: Region, u: number) {
  return region.dataXStart + region.dataXEnd - u
}
function hashCellR(r1: number, r2: number, bin1: number, bin2: number) {
  return (
    Math.imul(bin1, 0x9e3779b1) ^
    Math.imul(bin2, 0x85ebca6b) ^
    Math.imul(r1 * 256 + r2, 0xc2b2ae35)
  )
}
function binAtR(data: Payload, i: number, regionIdx: number, axis: number) {
  const { instances, regions, binWidth } = data
  const region = regions[regionIdx]!
  const m = getInstancePositionR(instances, i, axis)
  const u = region.reversed ? mirrorUR(region, m) - binWidth : m
  return Math.round(u / binWidth - region.combinedOffset)
}
function buildRecover(data: Payload) {
  const { numContacts, pairRuns } = data
  const capacity = capacityFor(numContacts)
  const slots = new Uint32Array(capacity)
  const mask = capacity - 1
  for (const { region1Idx, region2Idx, start, end } of pairRuns) {
    const sameRegion = region1Idx === region2Idx
    for (let i = start; i < end; i++) {
      const a = binAtR(data, i, region1Idx, 0)
      const b = binAtR(data, i, region2Idx, 1)
      const bin1 = sameRegion && a > b ? b : a
      const bin2 = sameRegion && a > b ? a : b
      let h = hashCellR(region1Idx, region2Idx, bin1, bin2) & mask
      while (slots[h] !== 0) {
        h = (h + 1) & mask
      }
      slots[h] = i + 1
    }
  }
  return { slots, mask }
}

// ------------------------------------------------------------ CONTROL ARM
// Byte-identical to R, through a second set of function literals so it gets its
// own inline caches. Whatever this scores is what the harness could resolve.
function getInstancePositionC(f32: Float32Array, i: number, c: number) {
  return f32[i * STRIDE_WORDS + c]!
}
function mirrorUC(region: Region, u: number) {
  return region.dataXStart + region.dataXEnd - u
}
function hashCellC(r1: number, r2: number, bin1: number, bin2: number) {
  return (
    Math.imul(bin1, 0x9e3779b1) ^
    Math.imul(bin2, 0x85ebca6b) ^
    Math.imul(r1 * 256 + r2, 0xc2b2ae35)
  )
}
function binAtC(data: Payload, i: number, regionIdx: number, axis: number) {
  const { instances, regions, binWidth } = data
  const region = regions[regionIdx]!
  const m = getInstancePositionC(instances, i, axis)
  const u = region.reversed ? mirrorUC(region, m) - binWidth : m
  return Math.round(u / binWidth - region.combinedOffset)
}
function buildControl(data: Payload) {
  const { numContacts, pairRuns } = data
  const capacity = capacityFor(numContacts)
  const slots = new Uint32Array(capacity)
  const mask = capacity - 1
  for (const { region1Idx, region2Idx, start, end } of pairRuns) {
    const sameRegion = region1Idx === region2Idx
    for (let i = start; i < end; i++) {
      const a = binAtC(data, i, region1Idx, 0)
      const b = binAtC(data, i, region2Idx, 1)
      const bin1 = sameRegion && a > b ? b : a
      const bin2 = sameRegion && a > b ? a : b
      let h = hashCellC(region1Idx, region2Idx, bin1, bin2) & mask
      while (slots[h] !== 0) {
        h = (h + 1) & mask
      }
      slots[h] = i + 1
    }
  }
  return { slots, mask }
}

// ---------------------------------------------------------------- ARM H
function hashCellH(r1: number, r2: number, bin1: number, bin2: number) {
  return (
    Math.imul(bin1, 0x9e3779b1) ^
    Math.imul(bin2, 0x85ebca6b) ^
    Math.imul(r1 * 256 + r2, 0xc2b2ae35)
  )
}
function buildHoisted(data: Payload) {
  const { numContacts, pairRuns, instances, regions, binWidth } = data
  const capacity = capacityFor(numContacts)
  const slots = new Uint32Array(capacity)
  const mask = capacity - 1
  const invBinWidth = 1 / binWidth
  for (const { region1Idx, region2Idx, start, end } of pairRuns) {
    const sameRegion = region1Idx === region2Idx
    const r1 = regions[region1Idx]!
    const r2 = regions[region2Idx]!
    const rev1 = r1.reversed
    const rev2 = r2.reversed
    const mirror1 = r1.dataXStart + r1.dataXEnd - binWidth
    const mirror2 = r2.dataXStart + r2.dataXEnd - binWidth
    const off1 = r1.combinedOffset
    const off2 = r2.combinedOffset
    const pairHash = hashCellH(region1Idx, region2Idx, 0, 0)
    for (let i = start; i < end; i++) {
      const o = i * STRIDE_WORDS
      const mx = instances[o]!
      const my = instances[o + 1]!
      const a = Math.round((rev1 ? mirror1 - mx : mx) * invBinWidth - off1)
      const b = Math.round((rev2 ? mirror2 - my : my) * invBinWidth - off2)
      const swap = sameRegion && a > b
      const bin1 = swap ? b : a
      const bin2 = swap ? a : b
      let h =
        (Math.imul(bin1, 0x9e3779b1) ^ Math.imul(bin2, 0x85ebca6b) ^ pairHash) &
        mask
      while (slots[h] !== 0) {
        h = (h + 1) & mask
      }
      slots[h] = i + 1
    }
  }
  return { slots, mask }
}

// ---------------------------------------------------------------- ARM T
function tilesPerAxisT(numContacts: number) {
  return Math.min(2048, Math.max(1, Math.ceil(Math.sqrt(numContacts / 8))))
}
function buildTile(data: Payload) {
  const { numContacts, instances, binWidth } = data
  let loX = Infinity
  let hiX = -Infinity
  let loY = Infinity
  let hiY = -Infinity
  for (let i = 0; i < numContacts; i++) {
    const o = i * STRIDE_WORDS
    const px = instances[o]!
    const py = instances[o + 1]!
    loX = px < loX ? px : loX
    hiX = px > hiX ? px : hiX
    loY = py < loY ? py : loY
    hiY = py > hiY ? py : hiY
  }
  const originX = numContacts > 0 ? loX : 0
  const originY = numContacts > 0 ? loY : 0
  const perAxis = tilesPerAxisT(numContacts)
  const spanX = Math.max((hiX - loX) / perAxis, binWidth)
  const spanY = Math.max((hiY - loY) / perAxis, binWidth)
  const invSpanX = 1 / spanX
  const invSpanY = 1 / spanY
  const tilesX = numContacts > 0 ? Math.floor((hiX - loX) * invSpanX) + 2 : 1
  const tilesY = numContacts > 0 ? Math.floor((hiY - loY) * invSpanY) + 2 : 1
  const nTiles = tilesX * tilesY
  const offsets = new Uint32Array(nTiles + 1)
  for (let i = 0; i < numContacts; i++) {
    const o = i * STRIDE_WORDS
    const tx = ((instances[o]! - originX) * invSpanX) | 0
    const ty = ((instances[o + 1]! - originY) * invSpanY) | 0
    const t = ty * tilesX + tx + 1
    offsets[t] = offsets[t]! + 1
  }
  for (let t = 0; t < nTiles; t++) {
    offsets[t + 1] = offsets[t + 1]! + offsets[t]!
  }
  const cursor = offsets.slice(0, nTiles)
  const items = new Uint32Array(numContacts)
  for (let i = 0; i < numContacts; i++) {
    const o = i * STRIDE_WORDS
    const tx = ((instances[o]! - originX) * invSpanX) | 0
    const ty = ((instances[o + 1]! - originY) * invSpanY) | 0
    const t = ty * tilesX + tx
    items[cursor[t]!] = i
    cursor[t] = cursor[t]! + 1
  }
  return {
    offsets,
    items,
    originX,
    originY,
    invSpanX,
    invSpanY,
    tilesX,
    tilesY,
  }
}

// One driver per arm. Deliberately not refactored into a shared helper taking
// the implementation as a parameter — that call site goes polymorphic and every
// arm pays for it.
function timeRecover(data: Payload, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildRecover(data)
  }
  return (performance.now() - t0) / reps
}
function timeControlArm(data: Payload, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildControl(data)
  }
  return (performance.now() - t0) / reps
}
function timeHoisted(data: Payload, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildHoisted(data)
  }
  return (performance.now() - t0) / reps
}
function timeTile(data: Payload, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildTile(data)
  }
  return (performance.now() - t0) / reps
}

// The filled upper triangle one displayed region produces — `numContacts` of
// them means a span of `sqrt(2n)` bins, which is the relation the index's own
// comment sizes the auto binsize by. Positions are written exactly the way the
// worker writes them: `(bin + combinedOffset) * binWidth`.
//
// The shape matters as much as the count. A thin diagonal band of the same
// numContacts leaves most of the bounding box empty, which piles every contact
// into a handful of tiles and prices the probe at 10x what a real matrix costs.
function makePayload(numContacts: number): Payload {
  const binWidth = 1234.5 / Math.SQRT2
  const combinedOffset = -18_000
  const instances = new Float32Array(numContacts * STRIDE_WORDS)
  const span = Math.ceil(Math.sqrt(2 * numContacts))
  let n = 0
  let bin1 = 18_000
  while (n < numContacts) {
    for (let d = 0; d + bin1 - 18_000 < span && n < numContacts; d++) {
      const o = n * STRIDE_WORDS
      instances[o] = (bin1 + combinedOffset) * binWidth
      instances[o + 1] = (bin1 + d + combinedOffset) * binWidth
      instances[o + 2] = 1 + ((n * 7) % 400)
      n++
    }
    bin1++
  }
  return {
    instances,
    numContacts,
    binWidth,
    regions: [
      {
        dataXStart: 0,
        // in data-x, not in bins: `(bin + combinedOffset) * binWidth` puts the
        // first bin at 0, so the region spans the bins written, not the
        // chromosome-absolute index they carry
        dataXEnd: (bin1 + combinedOffset) * binWidth,
        combinedOffset,
        reversed: false,
      },
    ],
    pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: numContacts }],
  }
}

// Identity is cross-structure: the hash and the grid file contacts differently,
// so what has to agree is the answer to a point query, not a field.
function lookupHash(
  data: Payload,
  table: { slots: Uint32Array; mask: number },
  ux: number,
  uy: number,
) {
  const { instances, binWidth, regions } = data
  const region = regions[0]!
  const bx = Math.floor(ux / binWidth - region.combinedOffset)
  const by = Math.floor(uy / binWidth - region.combinedOffset)
  const bin1 = bx > by ? by : bx
  const bin2 = bx > by ? bx : by
  let h = hashCellR(0, 0, bin1, bin2) & table.mask
  let slot = table.slots[h]!
  while (slot !== 0) {
    const i = slot - 1
    const px = instances[i * STRIDE_WORDS]!
    const py = instances[i * STRIDE_WORDS + 1]!
    if (ux >= px && ux < px + binWidth && uy >= py && uy < py + binWidth) {
      return i
    }
    h = (h + 1) & table.mask
    slot = table.slots[h]!
  }
  return undefined
}
function lookupTile(
  data: Payload,
  index: ReturnType<typeof buildTile>,
  ux: number,
  uy: number,
) {
  const { instances, binWidth, regions } = data
  const {
    offsets,
    items,
    originX,
    originY,
    invSpanX,
    invSpanY,
    tilesX,
    tilesY,
  } = index
  const region = regions[0]!
  const bx = Math.floor(ux / binWidth - region.combinedOffset)
  const by = Math.floor(uy / binWidth - region.combinedOffset)
  const bin1 = bx > by ? by : bx
  const bin2 = bx > by ? bx : by
  const tx = ((ux - originX) * invSpanX) | 0
  const ty = ((uy - originY) * invSpanY) | 0
  const x0 = Math.max(0, Math.min(tx - 1, tilesX - 1))
  const x1 = Math.min(tx, tilesX - 1)
  const y0 = Math.max(0, Math.min(ty - 1, tilesY - 1))
  const y1 = Math.min(ty, tilesY - 1)
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const t = gy * tilesX + gx
      const end = offsets[t + 1]!
      for (let k = offsets[t]!; k < end; k++) {
        const i = items[k]!
        const px = instances[i * STRIDE_WORDS]!
        const py = instances[i * STRIDE_WORDS + 1]!
        const a = Math.round(px / binWidth - region.combinedOffset)
        const b = Math.round(py / binWidth - region.combinedOffset)
        const swap = a > b
        if (
          (swap ? b : a) === bin1 &&
          (swap ? a : b) === bin2 &&
          ux >= px &&
          ux < px + binWidth &&
          uy >= py &&
          uy < py + binWidth
        ) {
          return i
        }
      }
    }
  }
  return undefined
}

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 7,
)
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)

{
  const data = makePayload(20_000)
  const r = buildRecover(data)
  const c = buildControl(data)
  const h = buildHoisted(data)
  const t = buildTile(data)
  const bw = data.binWidth
  let probes = 0
  let hits = 0
  for (let i = 0; i < data.numContacts; i += 7) {
    // cell centre, then a point one third of a cell into the neighbour
    for (const f of [0.5, 1.34]) {
      const px = data.instances[i * STRIDE_WORDS]! + f * bw
      const py = data.instances[i * STRIDE_WORDS + 1]! + f * bw
      const a = lookupHash(data, r, px, py)
      probes++
      if (a !== undefined) {
        hits++
      }
      for (const [name, got] of [
        ['control', lookupHash(data, c, px, py)],
        ['hoisted', lookupHash(data, h, px, py)],
        ['tile', lookupTile(data, t, px, py)],
      ] as const) {
        if (got !== a) {
          throw new Error(
            `${name} disagrees at (${px}, ${py}): recover ${a}, ${name} ${got}`,
          )
        }
      }
    }
  }
  console.log(
    `identity: all four indexes answer ${probes} point queries alike, ${hits} of them over a contact`,
  )
}

console.log(
  `\n${'contacts'.padStart(10)}  ${'recover'.padStart(8)}  ${'hoisted'.padStart(8)}  ` +
    `${'tile'.padStart(8)}  ${'vs recover'.padStart(10)}  ${'control'.padStart(7)}  ${'saved ms'.padStart(8)}`,
)
for (const n of [300_000, 1_000_000, 4_500_000]) {
  if (only && String(n) !== only) {
    continue
  }
  const data = makePayload(n)
  const reps = n > 2_000_000 ? 3 : 10
  for (let r = 0; r < 8; r++) {
    timeRecover(data, 1)
    timeHoisted(data, 1)
    timeTile(data, 1)
    timeControlArm(data, 1)
  }
  let rec = Infinity
  let hoi = Infinity
  let til = Infinity
  let ctl = Infinity
  for (let round = 0; round < rounds; round++) {
    rec = Math.min(rec, timeRecover(data, reps))
    hoi = Math.min(hoi, timeHoisted(data, reps))
    til = Math.min(til, timeTile(data, reps))
    ctl = Math.min(ctl, timeControlArm(data, reps))
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${rec.toFixed(2).padStart(8)}  ` +
      `${hoi.toFixed(2).padStart(8)}  ${til.toFixed(2).padStart(8)}  ` +
      `${(rec / til).toFixed(2).concat('x').padStart(10)}  ` +
      `${(ctl / rec).toFixed(3).padStart(7)}  ${(rec - til).toFixed(2).padStart(8)}`,
  )
}
console.log(
  '\nms per build, min of interleaved rounds. `saved ms` is what comes off the\n' +
    'render that blocks the first hover after a fetch. A control far from 1.00\n' +
    'means the row measured nothing; re-run that size with --only=<n>.',
)

// The other half of the trade. The hash went straight to one slot; the grid
// scans a 2x2 tile neighbourhood and recovers the bins of what it finds there,
// so whatever the build saves has to survive being paid back per mousemove.
function makeProbePoints(data: Payload, n: number) {
  const pts = new Float64Array(n * 2)
  const step = Math.max(1, Math.floor(data.numContacts / n))
  for (let k = 0; k < n; k++) {
    const o = ((k * step) % data.numContacts) * STRIDE_WORDS
    pts[k * 2] = data.instances[o]! + data.binWidth / 2
    pts[k * 2 + 1] = data.instances[o + 1]! + data.binWidth / 2
  }
  return pts
}
function timeProbeHash(
  data: Payload,
  table: { slots: Uint32Array; mask: number },
  pts: Float64Array,
) {
  const t0 = performance.now()
  let sink = 0
  for (let k = 0; k < pts.length; k += 2) {
    sink += lookupHash(data, table, pts[k]!, pts[k + 1]!) ?? 0
  }
  return { ms: performance.now() - t0, sink }
}
function timeProbeTile(
  data: Payload,
  index: ReturnType<typeof buildTile>,
  pts: Float64Array,
) {
  const t0 = performance.now()
  let sink = 0
  for (let k = 0; k < pts.length; k += 2) {
    sink += lookupTile(data, index, pts[k]!, pts[k + 1]!) ?? 0
  }
  return { ms: performance.now() - t0, sink }
}

console.log(
  `\n${'contacts'.padStart(10)}  ${'hash us'.padStart(8)}  ${'tile us'.padStart(8)}  ${'worst tile'.padStart(10)}`,
)
for (const n of [300_000, 1_000_000, 4_500_000]) {
  if (only && String(n) !== only) {
    continue
  }
  const data = makePayload(n)
  const table = buildRecover(data)
  const index = buildTile(data)
  const pts = makeProbePoints(data, 2000)
  const a = timeProbeHash(data, table, pts)
  const b = timeProbeTile(data, index, pts)
  if (a.sink !== b.sink) {
    throw new Error(`probe arms disagree: hash ${a.sink}, tile ${b.sink}`)
  }
  let hashMs = Infinity
  let tileMs = Infinity
  for (let round = 0; round < rounds; round++) {
    hashMs = Math.min(hashMs, timeProbeHash(data, table, pts).ms)
    tileMs = Math.min(tileMs, timeProbeTile(data, index, pts).ms)
  }
  let worst = 0
  for (let t = 0; t < index.tilesX * index.tilesY; t++) {
    const c = index.offsets[t + 1]! - index.offsets[t]!
    if (c > worst) {
      worst = c
    }
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${((hashMs / pts.length) * 2000).toFixed(2).padStart(8)}  ` +
      `${((tileMs / pts.length) * 2000).toFixed(2).padStart(8)}  ${String(worst).padStart(10)}`,
  )
}
console.log(
  '\nmicroseconds per probe, min of interleaved rounds, over cell centres. One\n' +
    'probe runs per mousemove, against one build per fetch. `worst tile` is the\n' +
    'fullest single tile, a quarter of the worst neighbourhood the grid scans.',
)
