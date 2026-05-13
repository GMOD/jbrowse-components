// Convert a GFA file's W-lines to P-lines, copying everything else verbatim.
// Needed because older odgi (v0.9.4) silently drops W-lines on `odgi build`,
// leaving the .og file with zero paths. Streaming line-by-line keeps memory
// flat regardless of file size.
//
// W syntax: W\t<sample>\t<hapidx>\t<seqid>\t<start>\t<end>\t<walk>
// P syntax: P\t<name>\t<seg1+,seg2-,...>\t<overlaps>
// Walk uses >id and <id; we emit id+ and id- in PanSN naming
// "<sample>#<hap>#<seqid>:<start>-<end>".

import fs from 'fs'
import readline from 'readline'

export async function convertWLinesToPLines(input: string, output: string) {
  const inStream = fs.createReadStream(input)
  const outStream = fs.createWriteStream(output)
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity })
  let pCount = 0
  let wCount = 0
  let other = 0
  for await (const line of rl) {
    if (line.length === 0) {
      continue
    }
    if (line[0] !== 'W') {
      outStream.write(line)
      outStream.write('\n')
      if (line[0] === 'P') {
        pCount++
      } else {
        other++
      }
      continue
    }
    // tab-split first 7 fields by hand (much faster than line.split('\t') for
    // a 1 GB file with long walk strings)
    const parts: string[] = []
    let cursor = 0
    for (let i = 0; i < 6; i++) {
      const t = line.indexOf('\t', cursor)
      if (t < 0) {
        break
      }
      parts.push(line.slice(cursor, t))
      cursor = t + 1
    }
    parts.push(line.slice(cursor))
    if (parts.length < 7 || parts[0] !== 'W') {
      outStream.write(line)
      outStream.write('\n')
      continue
    }
    const sample = parts[1]!
    const hap = parts[2]!
    const seqid = parts[3]!
    const start = parts[4]!
    const end = parts[5]!
    const walk = parts[6]!
    const name = `${sample}#${hap}#${seqid}:${start}-${end}`
    const segStr = walkToSegStr(walk)
    outStream.write('P\t')
    outStream.write(name)
    outStream.write('\t')
    outStream.write(segStr)
    outStream.write('\t*\n')
    wCount++
  }
  await new Promise<void>(resolve => {
    outStream.end(() => {
      resolve()
    })
  })
  return { wCount, pCount, other }
}

function walkToSegStr(walk: string): string {
  const out: string[] = []
  const len = walk.length
  let i = 0
  while (i < len) {
    const c = walk.charCodeAt(i)
    // > = 0x3e, < = 0x3c
    if (c !== 0x3e && c !== 0x3c) {
      i++
      continue
    }
    const orient = c === 0x3e ? '+' : '-'
    i++
    const start = i
    while (i < len) {
      const cc = walk.charCodeAt(i)
      if (cc === 0x3e || cc === 0x3c) {
        break
      }
      i++
    }
    out.push(walk.slice(start, i) + orient)
  }
  return out.join(',')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , input, output] = process.argv
  if (!input || !output) {
    console.error('usage: node wToP.ts <input.gfa> <output.gfa>')
    process.exit(1)
  }
  const t0 = Date.now()
  convertWLinesToPLines(input, output).then(stats => {
    console.log(
      `[wToP] converted ${stats.wCount} W → P, ${stats.pCount} P preserved, ${stats.other} other lines, ${Date.now() - t0}ms`,
    )
  })
}
