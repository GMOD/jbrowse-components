// A synthetic genome plus a reference annotation and a prediction that
// deliberately produces one candidate of every class the classifier knows.
// Deterministic, offline, and small enough to keep in the repo.
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] || path.join(import.meta.dirname, 'fixture')
fs.mkdirSync(OUT, { recursive: true })

const CONTIGS = [
  { name: 'ctgA', length: 120000 },
  { name: 'ctgB', length: 60000 },
]

// a fixed LCG so the sequence is the same on every machine
let seed = 20260825
const rand = () =>
  (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff

function sequence(len) {
  const bases = 'ACGT'
  let s = ''
  for (let i = 0; i < len; i++) {
    s += bases[Math.floor(rand() * 4)]
  }
  return s
}

const fasta = CONTIGS.map(c => {
  const seq = sequence(c.length)
  const lines = []
  for (let i = 0; i < seq.length; i += 60) {
    lines.push(seq.slice(i, i + 60))
  }
  return `>${c.name}\n${lines.join('\n')}`
}).join('\n')
fs.writeFileSync(path.join(OUT, 'genome.fa'), `${fasta}\n`)

// --- gene models -----------------------------------------------------------

const ref = []
const pred = []

function exonsFor(start, count, exonLen = 300, intronLen = 900) {
  const out = []
  let p = start
  for (let i = 0; i < count; i++) {
    out.push([p, p + exonLen - 1])
    p += exonLen + intronLen
  }
  return out
}

function gffGene({
  rows,
  contig,
  id,
  name,
  strand,
  exons,
  isoforms,
  type = 'protein_coding',
  src,
}) {
  const forms = isoforms || [exons]
  const start = Math.min(...forms.map(f => f[0][0]))
  const end = Math.max(...forms.map(f => f[f.length - 1][1]))
  rows.push([
    contig,
    src,
    'gene',
    start,
    end,
    '.',
    strand,
    '.',
    `ID=${id};Name=${name};gene_name=${name};gene_type=${type}`,
  ])
  forms.forEach((form, i) => {
    const tx = `${id}.t${i + 1}`
    rows.push([
      contig,
      src,
      'mRNA',
      form[0][0],
      form[form.length - 1][1],
      '.',
      strand,
      '.',
      `ID=${tx};Parent=${id};Name=${name}.t${i + 1};gene_name=${name};gene_type=${type}`,
    ])
    for (const [s, e] of form) {
      rows.push([
        contig,
        src,
        'exon',
        s,
        e,
        '.',
        strand,
        '.',
        `Parent=${tx};gene_name=${name};gene_type=${type}`,
      ])
      rows.push([
        contig,
        src,
        'CDS',
        s,
        e,
        '.',
        strand,
        0,
        `Parent=${tx};gene_name=${name};gene_type=${type}`,
      ])
    }
  })
}

function predTx({ contig, id, strand, exons }) {
  const start = exons[0][0]
  const end = exons[exons.length - 1][1]
  pred.push([
    contig,
    'Tiberius',
    'transcript',
    start,
    end,
    '.',
    strand,
    '.',
    `ID=${id}.t1;geneID=${id}`,
  ])
  for (const [s, e] of exons) {
    pred.push([
      contig,
      'Tiberius',
      'exon',
      s,
      e,
      '.',
      strand,
      '.',
      `Parent=${id}.t1`,
    ])
    pred.push([
      contig,
      'Tiberius',
      'CDS',
      s,
      e,
      '.',
      strand,
      0,
      `Parent=${id}.t1`,
    ])
  }
}

// six models that agree exactly with the reference
let at = 4000
const agreeing = []
for (let i = 1; i <= 6; i++) {
  const strand = i % 2 ? '+' : '-'
  const exons = exonsFor(at, 4)
  gffGene({
    rows: ref,
    contig: 'ctgA',
    id: `REFG${i}`,
    name: `AGREE${i}`,
    strand,
    exons,
    src: 'fixture',
  })
  predTx({ contig: 'ctgA', id: `g${i}`, strand, exons })
  agreeing.push(exons)
  at = exons[exons.length - 1][1] + 5000
}

// MERGE: two adjacent non-overlapping same-strand genes, one prediction over both
const mergeA = exonsFor(at, 3)
at = mergeA[mergeA.length - 1][1] + 4000
const mergeB = exonsFor(at, 3)
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFM1',
  name: 'FUSEA',
  strand: '+',
  exons: mergeA,
  src: 'fixture',
})
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFM2',
  name: 'FUSEB',
  strand: '+',
  exons: mergeB,
  src: 'fixture',
})
predTx({
  contig: 'ctgA',
  id: 'g100',
  strand: '+',
  exons: [...mergeA, ...mergeB],
})
at = mergeB[mergeB.length - 1][1] + 6000

// STRUCTURE CONFLICT: same locus, no shared junction
const refConf = exonsFor(at, 4, 300, 900)
const predConf = exonsFor(at + 150, 4, 260, 980)
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFC1',
  name: 'SHIFTY',
  strand: '-',
  exons: refConf,
  src: 'fixture',
})
predTx({ contig: 'ctgA', id: 'g200', strand: '-', exons: predConf })
at = refConf[refConf.length - 1][1] + 6000

// NOVEL CODING: reference annotates only a lncRNA here
const nc = exonsFor(at, 3)
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFL1',
  name: 'LINCX',
  strand: '+',
  exons: nc,
  type: 'lncRNA',
  src: 'fixture',
})
predTx({
  contig: 'ctgA',
  id: 'g300',
  strand: '+',
  exons: nc.map(([s, e]) => [s + 20, e - 20]),
})

// NESTED, SAME STRAND: a small gene sitting inside a big gene's intron, and a
// prediction that correctly calls only the big one. Span overlap reports this
// as a two-gene merge; exon overlap does not. This is the case that makes the
// exon test load-bearing, so the sabotage check has something to fail on.
at += 4000
const outer = [
  [at, at + 300],
  [at + 12000, at + 12300],
  [at + 16000, at + 16300],
]
const innerStart = at + 4000
const inner = exonsFor(innerStart, 2, 250, 700)
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFO1',
  name: 'OUTER',
  strand: '+',
  exons: outer,
  src: 'fixture',
})
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFI1',
  name: 'INNER',
  strand: '+',
  exons: inner,
  src: 'fixture',
})
predTx({ contig: 'ctgA', id: 'g500', strand: '+', exons: outer })

// TWO ISOFORMS, and a prediction that matches the second one exactly. Sorting
// both isoforms' exons into one list and joining consecutive pairs — the
// shortcut this case exists to fail — invents junctions neither transcript has
// and leaves g600.t1 sharing none of them, so it lands in structure conflict
// while being perfectly correct. Every other gene here has one isoform, which
// is why the shortcut survived the fixture for as long as it did.
at = outer[outer.length - 1][1] + 6000
const isoA = [
  [at + 1, at + 200],
  [at + 401, at + 600],
  [at + 801, at + 1000],
  [at + 1201, at + 1400],
]
const isoB = [
  [at + 1, at + 300],
  [at + 701, at + 1100],
  [at + 1201, at + 1400],
]
gffGene({
  rows: ref,
  contig: 'ctgA',
  id: 'REFT1',
  name: 'TWOFORM',
  strand: '+',
  isoforms: [isoA, isoB],
  src: 'fixture',
})
predTx({ contig: 'ctgA', id: 'g600', strand: '+', exons: isoB })

// NOVEL LOCUS: nothing in the reference on ctgB
predTx({ contig: 'ctgB', id: 'g400', strand: '-', exons: exonsFor(8000, 3) })
predTx({ contig: 'ctgB', id: 'g401', strand: '+', exons: exonsFor(30000, 2) })

const fmt = rows =>
  `##gff-version 3\n${CONTIGS.map(
    c => `##sequence-region ${c.name} 1 ${c.length}`,
  ).join('\n')}\n${rows
    .slice()
    .sort(
      (a, b) =>
        String(a[0]).localeCompare(String(b[0])) || a[3] - b[3] || a[4] - b[4],
    )
    .map(r => r.join('\t'))
    .join('\n')}\n`

fs.writeFileSync(path.join(OUT, 'reference.gff3'), fmt(ref))
fs.writeFileSync(path.join(OUT, 'prediction.gff3'), fmt(pred))

console.log('fixture written to', OUT)
console.log('  reference genes:', ref.filter(r => r[2] === 'gene').length)
console.log(
  '  predicted transcripts:',
  pred.filter(r => r[2] === 'transcript').length,
)
console.log(
  '  expected: 8 agree, 1 merge, 1 structure-conflict, 1 novel-coding, 2 novel-locus',
)
