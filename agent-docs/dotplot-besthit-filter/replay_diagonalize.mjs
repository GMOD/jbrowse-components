import { execSync } from 'node:child_process'

// Decompress the PIF (bgzip is gzip-compatible for full decompress)
const raw = execSync('zcat /tmp/hap1.pif.gz', { maxBuffer: 1 << 30 }).toString()
const lines = raw.split('\n').filter(Boolean)

// Only the q-prefixed rows: query = haplotype contig (vertical axis),
// target = GRCh38 chromosome (horizontal axis). This mirrors what the dotplot's
// vertical (query) diagonalize consumes.
const alns = []
for (const l of lines) {
  const f = l.split('\t')
  const q = f[0]
  if (q[0] !== 'q') {continue}
  const queryRefName = q.slice(1) // strip 'q' prefix
  const refStart = +f[7]
  const refEnd = +f[8]
  const refRefName = f[5]
  const strand = f[4] === '-' ? -1 : 1
  alns.push({ queryRefName, refRefName, refStart, refEnd, strand })
}
console.log('q-alignments:', alns.length)

// replicate diagonalizeRegions core
const queryGroups = new Map()
for (const a of alns) {
  const len = a.refEnd - a.refStart
  if (!queryGroups.has(a.queryRefName)) {queryGroups.set(a.queryRefName, new Map())}
  const g = queryGroups.get(a.queryRefName)
  if (!g.has(a.refRefName)) {g.set(a.refRefName, { bases: 0, wsum: 0, ssum: 0 })}
  const d = g.get(a.refRefName)
  d.bases += len
  d.wsum += ((a.refStart + a.refEnd) / 2) * len
  d.ssum += (a.strand >= 0 ? 1 : -1) * len
}

const chrOrder = ['chr1','chr2','chr3','chr4','chr5','chr6','chr7','chr8','chr9','chr10','chr11','chr12','chr13','chr14','chr15','chr16','chr17','chr18','chr19','chr20','chr21','chr22','chrX','chrY']
const refOrder = new Map(chrOrder.map((r, i) => [r, i]))

const ordering = []
for (const [vchrom, group] of queryGroups) {
  let bestRef = ''
  let best = { bases: 0, wsum: 0, ssum: 0 }
  let total = 0
  for (const [h, d] of group) {
    total += d.bases
    if (d.bases > best.bases) { bestRef = h; best = d }
  }
  ordering.push({
    refName: vchrom,
    bestRef,
    bestFrac: (best.bases / total),
    bestPos: best.wsum / best.bases,
    reverse: best.ssum < 0,
    nRefs: group.size,
  })
}

ordering.sort((a, b) => {
  const ai = refOrder.get(a.bestRef) ?? Infinity
  const bi = refOrder.get(b.bestRef) ?? Infinity
  return ai - bi || a.bestPos - b.bestPos
})

console.log('\nDiagonalized order (first=bottom of plot):')
for (const o of ordering) {
  console.log(
    o.refName.padEnd(20),
    '-> best', o.bestRef.padEnd(6),
    'frac', o.bestFrac.toFixed(2),
    'nChr', String(o.nRefs).padStart(2),
    o.reverse ? 'REV' : '',
  )
}
