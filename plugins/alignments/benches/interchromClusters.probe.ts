// The two numbers ideas/arc-band-open-calls.md says nobody has read, off the
// HG002 300x BAM over HTTP range requests:
//
//   node --experimental-strip-types plugins/alignments/benches/interchromClusters.probe.ts [ref] [start] [end]
//   node --experimental-strip-types plugins/alignments/benches/interchromClusters.probe.ts 1 2000000 2200000
//
// 1. What `clusteredInterchromSupport`'s single-linkage rule makes of a deep
//    window: the cluster size and DIAMETER distribution, against the same
//    connections cut into fixed window-sized cells (the diameter-capped
//    alternative the doc declines to build unmeasured).
// 2. How many arcs cross a seam when the window is split in two — what
//    `CROSS_REGION_ARC_CAP` was sized from an estimate of.
//
// Hits the network, is in no CI run, and is a counter report rather than a
// comparative bench. The connections are built the way `offScreenMateArcs`
// builds them (fragment-outer edge on this side, PNEXT on the far side, the
// default flag filter applied), not through the worker.
import { BamFile } from '@gmod/bam'
import { RemoteFile } from 'generic-filehandle2'

import { clusteredInterchromSupport } from '../src/features/arcs/arcClustering.ts'
import {
  getInsertSizeStats,
  widenBandToEventScale,
} from '../src/shared/insertSizeStats.ts'
import { defaultFilterFlags } from '../src/shared/util.ts'

import type { PendingArc } from '../src/features/arcs/arcTypes.ts'
import type { BamRecord } from '@gmod/bam'

const URL =
  'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/NIST_HiSeq_HG002_Homogeneity-10953946/NHGRI_Illumina300X_AJtrio_novoalign_bams/HG002.hs37d5.300x.bam'

const REF = process.argv[2] ?? '1'
const START = Number(process.argv[3] ?? 2_000_000)
const END = Number(process.argv[4] ?? 2_200_000)

const SAM_PAIRED = 0x1
const SAM_PROPER = 0x2
const SAM_MATE_UNMAPPED = 0x8
const SAM_REVERSE = 0x10
const SAM_SECONDARY = 0x100
const SAM_SUPPLEMENTARY = 0x800

function quantiles(sorted: number[]) {
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return `n=${sorted.length} min=${sorted[0]} p50=${at(0.5)} p90=${at(0.9)} p99=${at(0.99)} max=${sorted.at(-1)}`
}

function histogram(values: number[], edges: number[]) {
  const counts = new Array<number>(edges.length + 1).fill(0)
  for (const v of values) {
    let i = 0
    while (i < edges.length && v > edges[i]!) {
      i++
    }
    counts[i]!++
  }
  return counts
    .map((c, i) => {
      const lo = i === 0 ? 1 : edges[i - 1]! + 1
      const hi = i === edges.length ? '∞' : edges[i]
      return `${lo}-${hi}: ${c}`
    })
    .join('  ')
}

interface Cluster {
  members: number[]
  spanA: number
  spanB: number
}

function clustersOf(arcs: PendingArc[], clusterOf: number[]): Cluster[] {
  const byId = new Map<number, Cluster>()
  for (let i = 0; i < arcs.length; i++) {
    const id = clusterOf[i]!
    if (id < 0) {
      continue
    }
    let c = byId.get(id)
    if (!c) {
      c = { members: [], spanA: 0, spanB: 0 }
      byId.set(id, c)
    }
    c.members.push(i)
  }
  for (const c of byId.values()) {
    let aMin = Infinity
    let aMax = -Infinity
    let bMin = Infinity
    let bMax = -Infinity
    for (const i of c.members) {
      const a = arcs[i]!
      aMin = Math.min(aMin, a.p1Bp)
      aMax = Math.max(aMax, a.p1Bp)
      bMin = Math.min(bMin, a.p2Bp)
      bMax = Math.max(bMax, a.p2Bp)
    }
    c.spanA = aMax - aMin
    c.spanB = bMax - bMin
  }
  return [...byId.values()]
}

// The diameter-capped alternative: a fixed grid of window-sized cells over both
// coordinates, no linking across cells, so no cluster is wider than the window.
function cappedClusterOf(arcs: PendingArc[], windowBp: number) {
  const ids = new Map<string, number>()
  return arcs.map(a => {
    const key = `${a.p1Ref}\0${a.p2Ref}\0${Math.floor(a.p1Bp / windowBp)}\0${Math.floor(a.p2Bp / windowBp)}`
    let id = ids.get(key)
    if (id === undefined) {
      id = ids.size
      ids.set(key, id)
    }
    return id
  })
}

function report(label: string, clusters: Cluster[], windowBp: number) {
  const sizes = clusters.map(c => c.members.length).sort((a, b) => a - b)
  const spans = clusters
    .map(c => Math.max(c.spanA, c.spanB))
    .sort((a, b) => a - b)
  const overWindow = clusters.filter(
    c => c.spanA > windowBp || c.spanB > windowBp,
  )
  const passing = clusters.filter(c => c.members.length >= 2)
  console.log(`\n${label}`)
  console.log(`  clusters ${quantiles(sizes)}`)
  console.log(`  size histogram  ${histogram(sizes, [1, 2, 3, 5, 10, 20, 50])}`)
  console.log(`  diameter bp ${quantiles(spans)}`)
  console.log(
    `  clusters wider than the window on either axis: ${overWindow.length}; widest A ${Math.max(...clusters.map(c => c.spanA))} B ${Math.max(...clusters.map(c => c.spanB))}`,
  )
  console.log(
    `  clearing a floor of 2: ${passing.length} clusters carrying ${passing.reduce((n, c) => n + c.members.length, 0)} connections`,
  )
}

async function main() {
  const bam = new BamFile({
    bamFilehandle: new RemoteFile(URL),
    baiFilehandle: new RemoteFile(`${URL}.bai`),
  })
  await bam.getHeader()
  const names = (
    bam as unknown as { indexToChr: { refName: string }[] }
  ).indexToChr.map(c => c.refName)
  const t0 = performance.now()
  const records = await bam.getRecordsForRange(REF, START, END)
  console.log(
    `${records.length} records over ${REF}:${START}-${END} in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
  )

  const kept = records.filter(
    r =>
      (r.flags & defaultFilterFlags.flagExclude) === 0 &&
      (r.flags & defaultFilterFlags.flagInclude) ===
        defaultFilterFlags.flagInclude,
  )
  const tlens: number[] = []
  for (const r of kept) {
    if (
      r.flags & SAM_PROPER &&
      !(r.flags & (SAM_SECONDARY | SAM_SUPPLEMENTARY)) &&
      r.template_length > 0
    ) {
      tlens.push(r.template_length)
    }
  }
  const band = widenBandToEventScale(getInsertSizeStats(Int32Array.from(tlens)))
  const windowBp = band.upper
  console.log(
    `${kept.length} pass the default flag filter; insert band ${band.lower.toFixed(0)}..${band.upper.toFixed(0)} from ${tlens.length} proper pairs, so the window is ${windowBp.toFixed(0)} bp`,
  )

  const arcs: PendingArc[] = []
  const partners = new Map<string, number>()
  for (const r of kept) {
    if (
      !(r.flags & SAM_PAIRED) ||
      r.flags & SAM_MATE_UNMAPPED ||
      r.flags & (SAM_SECONDARY | SAM_SUPPLEMENTARY) ||
      r.next_refid < 0 ||
      r.next_refid === r.ref_id ||
      !r.next_pos
    ) {
      continue
    }
    const strand = r.flags & SAM_REVERSE ? -1 : 1
    const mateRef = names[r.next_refid] ?? String(r.next_refid)
    partners.set(mateRef, (partners.get(mateRef) ?? 0) + 1)
    arcs.push({
      p1Ref: REF,
      p1Bp: strand === -1 ? r.end : r.start,
      p1Strand: strand,
      p1Dir: -strand,
      p2Ref: mateRef,
      p2Bp: r.next_pos,
      p2Strand: r.flags & 0x20 ? -1 : 1,
      p2Dir: r.flags & 0x20 ? 1 : -1,
      isSplit: false,
      pairOrientationNum: 0,
      tlen: r.template_length,
      flags: r.flags,
    })
  }
  console.log(
    `${arcs.length} interchromosomal connections to ${partners.size} partner contigs; top partners ${[
      ...partners.entries(),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')}`,
  )
  const sameCoord = new Set(arcs.map(a => `${a.p1Bp}`)).size
  console.log(
    `  distinct source coordinates ${sameCoord} (arcKey coalesces the rest); mean spacing ${((END - START) / arcs.length).toFixed(0)} bp`,
  )

  const shipped = clusteredInterchromSupport(arcs, windowBp)
  report(
    `single-linkage within ${windowBp.toFixed(0)} bp on both axes (shipped)`,
    clustersOf(arcs, shipped.clusterOf),
    windowBp,
  )
  report(
    `fixed ${windowBp.toFixed(0)} bp cells, no linking across (capped)`,
    clustersOf(arcs, cappedClusterOf(arcs, windowBp)),
    windowBp,
  )
  for (const w of [250, 500]) {
    const alt = clusteredInterchromSupport(arcs, w)
    report(
      `single-linkage within ${w} bp (narrower window)`,
      clustersOf(arcs, alt.clusterOf),
      w,
    )
  }

  // The seam count: pairs with both primary mates in the window whose outer
  // edges — the arc's two feet — fall either side of the midpoint. Each is one
  // mate-link arc; proper pairs are the bulk and are what
  // `drawProperPairArcs: false` drops.
  const mid = Math.floor((START + END) / 2)
  const byName = new Map<string, BamRecord[]>()
  for (const r of kept) {
    if (
      !(r.flags & SAM_PAIRED) ||
      r.flags & SAM_MATE_UNMAPPED ||
      r.flags & (SAM_SECONDARY | SAM_SUPPLEMENTARY) ||
      r.next_refid !== r.ref_id
    ) {
      continue
    }
    let mates = byName.get(r.name)
    if (!mates) {
      mates = []
      byName.set(r.name, mates)
    }
    mates.push(r)
  }
  let pairs = 0
  let crossing = 0
  let crossingImproper = 0
  const keys = new Set<string>()
  for (const mates of byName.values()) {
    if (mates.length !== 2) {
      continue
    }
    pairs++
    const [m1, m2] = mates as [BamRecord, BamRecord]
    const outer = (r: BamRecord) => (r.flags & SAM_REVERSE ? r.end : r.start)
    const a = outer(m1)
    const b = outer(m2)
    if (a < mid !== b < mid) {
      crossing++
      keys.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
      if (!(m1.flags & SAM_PROPER)) {
        crossingImproper++
      }
    }
  }
  console.log(
    `\nsplit at ${mid}: of ${pairs} pairs with both mates loaded, ${crossing} straddle the seam (${keys.size} distinct arcs after arcKey coalescing), ${crossingImproper} of them not proper pairs; CROSS_REGION_ARC_CAP is 600`,
  )
}

await main()
