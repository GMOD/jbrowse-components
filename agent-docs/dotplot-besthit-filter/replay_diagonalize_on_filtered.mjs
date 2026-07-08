import fs from 'node:fs'

// parse a nucmer .delta, run our diagonalizeRegions ordering, print order
function order(deltaPath) {
  const lines = fs.readFileSync(deltaPath, 'utf8').split('\n')
  const alns = []
  let chr = ''; let contig = ''
  for (const l of lines) {
    if (l.startsWith('>')) {
      const p = l.slice(1).split(/\s+/)
      chr = p[0]; contig = p[1]
    } else if (/^\d+ \d+ \d+ \d+ /.test(l)) {
      const [rs, re, qs, qe] = l.split(/\s+/).map(Number)
      alns.push({
        refRefName: chr,
        queryRefName: contig,
        refStart: Math.min(rs, re),
        refEnd: Math.max(rs, re),
        strand: qs <= qe ? 1 : -1,
      })
    }
  }
  const g = new Map()
  for (const a of alns) {
    const len = a.refEnd - a.refStart
    if (!g.has(a.queryRefName)) {g.set(a.queryRefName, new Map())}
    const m = g.get(a.queryRefName)
    if (!m.has(a.refRefName)) {m.set(a.refRefName, { bases: 0, wsum: 0, ssum: 0 })}
    const d = m.get(a.refRefName)
    d.bases += len; d.wsum += ((a.refStart + a.refEnd) / 2) * len
    d.ssum += (a.strand >= 0 ? 1 : -1) * len
  }
  const chrOrder = [...new Array(22)].map((_, i) => `chr${i + 1}`).concat(['chrX', 'chrY'])
  const refOrder = new Map(chrOrder.map((r, i) => [r, i]))
  const ord = []
  for (const [v, m] of g) {
    let bestRef = ''; let best = { bases: 0, wsum: 0, ssum: 0 }; let total = 0
    for (const [h, d] of m) { total += d.bases; if (d.bases > best.bases) { bestRef = h; best = d } }
    ord.push({ refName: v, bestRef, frac: best.bases / total, pos: best.wsum / best.bases, rev: best.ssum < 0 })
  }
  ord.sort((a, b) => (refOrder.get(a.bestRef) ?? 1e9) - (refOrder.get(b.bestRef) ?? 1e9) || a.pos - b.pos)
  return ord
}

const raw = order('/tmp/hap1.delta')
const flt = order('/tmp/hap1.rq.delta')

const fmt = o => o.map(x => x.refName.replace('haplotype1-00000', '')).join(' ')
console.log('UNFILTERED order:', fmt(raw))
console.log('FILTERED   order:', fmt(flt))

// compare best-chr assignment per contig
const rawMap = new Map(raw.map(x => [x.refName, x]))
console.log('\ncontig   unfilt.best (frac)   filt.best (frac)   changed?')
for (const f of flt) {
  const r = rawMap.get(f.refName)
  const changed = r && r.bestRef !== f.bestRef ? '  <== BEST-CHR CHANGED' : ''
  console.log(
    f.refName.replace('haplotype1-00000', 'c').padEnd(7),
    (r ? `${r.bestRef}(${r.frac.toFixed(2)})` : 'DROPPED').padEnd(20),
    `${f.bestRef}(${f.frac.toFixed(2)})`.padEnd(18),
    changed,
  )
}
// contigs dropped entirely by filtering
const fltNames = new Set(flt.map(x => x.refName))
const dropped = raw.filter(x => !fltNames.has(x.refName)).map(x => x.refName.replace('haplotype1-00000', 'c'))
console.log('\ncontigs with NO alignments after filter:', dropped.join(' ') || '(none)')
