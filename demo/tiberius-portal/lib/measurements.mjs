import { execFileSync } from 'node:child_process'
// The counts this pipeline reports, written as measurement records rather than
// typed into a tutorial.
//
// Every number a tutorial states about a run is one nothing re-derives, and
// this pipeline proved it: a fixed classifier moved chr22's structure conflicts
// from 21 to 3 and took a card the prose named with it. `agent-docs/measurements`
// is the repo's answer — a record carries the values and a `repro`, and
// `pnpm autogen` splices them into the table and the sentences.
import fs from 'node:fs'
import path from 'node:path'

const today = () => new Date().toISOString().slice(0, 10)

// `bench` in the schema is "a script in this repo emits the values", which is
// what the flag that calls this makes true.
const record = (id, { repro, notes, published, columns, rows }) => ({
  id,
  measured: today(),
  published,
  source: { kind: 'bench', repro, notes },
  columns,
  rows,
})

const text = (key, label) => ({ key, label, format: 'text' })
const count = (key, label) => ({
  key,
  label,
  format: 'int',
  align: 'right',
})

export function classTable({ id, repro, classes, classOrder, tally, region }) {
  return record(id, {
    repro,
    // The agent-doc carries this table whole; the tutorial keeps its own
    // wording and quotes the cells, which is the half that drifts.
    published: false,
    notes:
      'One row per class the comparison sorts a predicted model into, and the count of models in it. ' +
      "The comparison is at exon level against same-strand genes, and a gene's junctions are the union of " +
      "its transcripts' introns — reading them off a flat sort of every isoform's exons invents junctions " +
      'no transcript has, which is what first reported 21 structure conflicts here rather than 3.',
    columns: [
      text('class', 'Class'),
      text('means', 'What it means'),
      count('models', region ? `On ${region}` : 'Models'),
      text('action', 'What an annotator does'),
    ],
    rows: ['agrees', ...classOrder]
      .filter(k => tally[k])
      .map(k => ({
        values: {
          class: classes[k].label,
          means: classes[k].why.replace(/\.$/, ''),
          models: tally[k],
          action: k === 'agrees' ? 'nothing' : classes[k].action.toLowerCase(),
        },
      })),
  })
}

export function runTable({
  id,
  repro,
  rows: modelRows,
  tally,
  bedRecords,
  region,
}) {
  const total = modelRows.length
  const quiet = modelRows.filter(
    r => r.cls === 'agrees' && r.conflicts.length,
  ).length
  const gaps = modelRows.flatMap(r => r.gaps.map(g => g.end - g.start))
  const facts = [
    ['Models predicted', total],
    ['Flagged for review', total - (tally.agrees || 0)],
    ['Records in conflicts.bed', bedRecords],
    ['Agreeing models carrying a junction edit', quiet],
    [
      'Widest gap inside a merged model, bp',
      gaps.length ? Math.max(...gaps) : null,
    ],
  ]
  return record(id, {
    repro,
    // Quoted a sentence at a time rather than carried as a table
    published: false,
    notes:
      'The counts around the class table. "Agreeing models carrying a junction edit" is the one the ' +
      'review page cannot show: a model sharing four junctions out of five is filed as `agrees` and ' +
      'never reaches a card, and the fifth is still a real splice-site edit. conflicts.bed lists them.',
    columns: [
      text('fact', 'What the run reports'),
      count('count', region || 'Count'),
    ],
    rows: facts
      .filter(([, v]) => v !== null)
      .map(([fact, value]) => ({ values: { fact, count: value } })),
  })
}

// A remote BAM read fails on the network often enough that an unretried one
// takes the whole portal build down with it — an HTTP/2 framing error from
// htslib, once, mid-run. Three goes, then the cell is absent, which a quoted
// reference reports at autogen time rather than silently.
function reads(bam, region, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return Number(
        execFileSync('samtools', ['view', '-c', bam, region], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
          .toString()
          .trim(),
      )
    } catch {
      /* try again */
    }
  }
  return null
}

// samtools names the contig the BAM does, and an RNA-seq BAM aligned to a
// no-prefix assembly says `22` where the annotations say `chr22`. Read it out
// of the header rather than probing a window: `samtools view -c` over a contig
// it does not have exits 0 and prints 0, so a probe cannot tell the wrong
// spelling from an empty region and every count comes back zero.
function refNameFor(bam, refName) {
  let header
  try {
    header = execFileSync('samtools', ['view', '-H', bam], {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).toString()
  } catch {
    return null
  }
  const names = new Set(
    [...header.matchAll(/^@SQ\t.*?\bSN:(\S+)/gm)].map(m => m[1]),
  )
  return [refName, refName.replace(/^chr/, ''), `chr${refName}`].find(n =>
    names.has(n),
  )
}

export function evidenceTable({ id, repro, candidates, loci, bams, names }) {
  const spelling = bams.map(b => refNameFor(b, candidates[0].refName))
  const columns = [
    text('model', 'Model'),
    text('genes', 'Reference genes'),
    ...bams.map((_, i) =>
      count(`rnaseq_${i + 1}`, names[i] || `RNA-seq ${i + 1}`),
    ),
  ]
  const rows = candidates.map((c, ci) => {
    const values = {
      model: c.id,
      genes: c.genes.length ? c.genes.join(' + ') : '—',
    }
    const [, range] = loci[ci].split(':')
    bams.forEach((bam, i) => {
      values[`rnaseq_${i + 1}`] = spelling[i]
        ? reads(bam, `${spelling[i]}:${range}`)
        : null
    })
    return { values }
  })
  return record(id, {
    repro,
    published: false,
    notes:
      'Reads overlapping the window each card shows — the padded locus, not the gene span, because that ' +
      'is what a reader sees. Two tissues because coverage splits both ways, and a model with reads in ' +
      'neither is the one worth doubting rather than the one to reject.',
    columns,
    rows,
  })
}

export function writeRecords(prefix, records) {
  const dir = path.dirname(prefix)
  fs.mkdirSync(dir, { recursive: true })
  return records.map(r => {
    const file = path.join(dir, `${r.id}.json`)
    fs.writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`)
    return file
  })
}
