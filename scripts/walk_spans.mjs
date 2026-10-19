#!/usr/bin/env node
//
// Where every haplotype's walk crosses a reference window, read from a
// gfa-to-tabix --walks file by range request: one line per walk, its PanSN
// name, the first and last base it covers in its own contig's coordinates, and
// the strand of its first step.
//
//   npm install @jbrowse/graph-walks @gmod/tabix generic-filehandle2
//   node walk_spans.mjs <prefix>.<sample>.walks.bed.gz GRCh38#0#chr1 103540000 103541000
//
// The file is a path or a URL, with its .tbi beside it.
import { TabixIndexedFile } from '@gmod/tabix'
import { WalkReader } from '@jbrowse/graph-walks'
import { LocalFile, RemoteFile } from 'generic-filehandle2'

const [file, refName, start, end] = process.argv.slice(2)
if (!file || !refName || !start || !end) {
  console.error('usage: walk_spans.mjs walks.bed.gz refName start end')
  process.exit(1)
}
const open = path =>
  /^https?:\/\//.test(path) ? new RemoteFile(path) : new LocalFile(path)
const reader = new WalkReader(
  new TabixIndexedFile({
    filehandle: open(file),
    tbiFilehandle: open(`${file}.tbi`),
  }),
)
const { fragments } = await reader.cut(
  refName,
  { start: Number(start), end: Number(end) },
  { context: 0, links: false },
)
for (const { name, hapStart, hapEnd, rev } of fragments) {
  console.log([name, hapStart, hapEnd, rev[0] ? '-' : '+'].join('\t'))
}
