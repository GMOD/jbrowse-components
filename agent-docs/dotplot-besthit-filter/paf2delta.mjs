import { execSync } from 'node:child_process'
import fs from 'node:fs'

const chrLen = new Map()
for (const l of fs.readFileSync('/tmp/chr.lens', 'utf8').split('\n').filter(Boolean)) {
  const [n, s] = l.split('\t'); chrLen.set(n, +s)
}
const ctgLen = new Map()
for (const l of fs.readFileSync('/tmp/contig.lens', 'utf8').split('\n').filter(Boolean)) {
  const [n, s] = l.split('\t'); ctgLen.set(n, +s)
}

const raw = execSync('zcat /tmp/hap1.pif.gz', { maxBuffer: 1 << 30 }).toString()
const CANON = new Set([...Array(22)].map((_, i) => `chr${i + 1}`).concat(['chrX', 'chrY']))

// group q-lines by (chr ref, contig qry)
const pairs = new Map()
let kept = 0
for (const l of raw.split('\n')) {
  if (!l || l[0] !== 'q') continue
  const f = l.split('\t')
  const contig = f[0].slice(1)
  const qs = +f[2], qe = +f[3], strand = f[4]
  const chr = f[5]
  const rs = +f[7] + 1, re = +f[8] // delta is 1-based inclusive
  if (!CANON.has(chr)) continue          // whole chromosomes only
  if (!ctgLen.has(contig)) continue
  kept++
  const key = chr + '\t' + contig
  if (!pairs.has(key)) pairs.set(key, [])
  // reverse strand: query coords decreasing
  const [aQs, aQe] = strand === '-' ? [qe, qs + 1] : [qs + 1, qe]
  pairs.get(key).push([rs, re, aQs, aQe])
}
console.error('kept q-alignments:', kept, 'pairs:', pairs.size)

const out = ['/tmp/ref.fa /tmp/qry.fa', 'NUCMER']
for (const [key, alns] of pairs) {
  const [chr, contig] = key.split('\t')
  out.push(`>${chr} ${contig} ${chrLen.get(chr)} ${ctgLen.get(contig)}`)
  for (const [rs, re, qs, qe] of alns) {
    // errors set to 0 (gapless approximation): coords drive layout + plotting
    out.push(`${rs} ${re} ${qs} ${qe} 0 0 0`)
    out.push('0')
  }
}
fs.writeFileSync('/tmp/hap1.delta', out.join('\n') + '\n')
console.error('wrote /tmp/hap1.delta')

// Rfile: canonical chromosome order
const rlines = [...CANON].map(c => `${c} ${chrLen.get(c)} +`)
fs.writeFileSync('/tmp/ref.order', rlines.join('\n') + '\n')
// Qfile: all contigs (natural order), lets layout reorder them
const qlines = [...ctgLen].map(([c, s]) => `${c} ${s} +`)
fs.writeFileSync('/tmp/qry.order', qlines.join('\n') + '\n')
console.error('wrote ref.order / qry.order')
