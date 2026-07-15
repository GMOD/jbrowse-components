#!/usr/bin/env node
// Debug ribbon plot that reads directly from a PIF file (the format the
// jbrowse-cli `make-pif` command produces). Renders separate PNGs for the
// fine tier (lowercase t/q) and the coarse tier (uppercase T/Q), so we can
// see what the LinearSyntenyView adapter is actually feeding the GPU at
// each level of detail.
//
// Usage: node scripts/ribbon-plot-pif.mjs <file.pif.gz> [outPrefix] [minBp]
//
// Mirrors scripts/ribbon-plot.mjs (chromosome painting by target, strand
// normalization, size-asc draw order). Only the input parser changes.

import { spawn } from 'child_process'
import fs from 'fs'
import readline from 'readline'

import { createCanvas } from 'canvas'

const PIF_FILE = process.argv[2]
const OUT_PREFIX = process.argv[3] || 'ribbon-pif'
const MIN_BP = Number.parseInt(process.argv[4] || '100000', 10)

if (!PIF_FILE) {
  console.error('usage: ribbon-plot-pif.mjs <file.pif.gz> [outPrefix] [minBp]')
  process.exit(1)
}

const MIN_CHR_ALN = 1_000_000

// Read PIF, splitting on prefix letter case.
// PIF row layout (after t/q prefix on col 1):
//   c1 l1 s1 e1 strand c2 l2 s2 e2 numMatches blockLen mapq tags...
// where (c1,s1,e1) are the *perspective* (indexed by tabix) and (c2,s2,e2)
// are the mate. We only consume rows whose perspective is t (target =
// hs1) so each alignment is emitted exactly once.
async function readPif(file) {
  const sh = spawn('sh', ['-c', `zcat "${file}"`])
  const rl = readline.createInterface({ input: sh.stdout, crlfDelay: Infinity })
  const fine = []
  const coarse = []
  const tSizes = new Map()
  const qSizes = new Map()
  for await (const line of rl) {
    const f = line.split('\t')
    const tag = f[0]
    const prefix = tag[0]
    // Skip query-side rows (q/Q) so we don't double-count — both perspectives
    // describe the same alignment.
    if (prefix !== 't' && prefix !== 'T') {
      continue
    }
    const tier = prefix === 'T' ? coarse : fine
    const tName = tag.slice(1)
    const tSize = +f[1]
    const tStart = +f[2]
    const tEnd = +f[3]
    const strand = f[4]
    const qName = f[5]
    const qSize = +f[6]
    let qStart = +f[7]
    let qEnd = +f[8]
    // PIF stores coords on the forward strand of each axis; ribbon-plot.mjs
    // does the same renorm — no need to flip negative strand here.
    if (strand === '-') {
      // Already forward on the q-axis in PIF; keep as is for parity with the
      // chain-based script which also stores forward-strand q-coords.
      void qStart
    }
    tier.push({
      tName,
      tStart,
      tEnd,
      qName,
      qStart,
      qEnd,
      qStrand: strand,
    })
    tSizes.set(tName, tSize)
    qSizes.set(qName, qSize)
  }
  return { fine, coarse, tSizes, qSizes }
}

function chrSortKey(name) {
  const m = /^chr(\d+|X|Y|M|MT)/i.exec(name)
  if (!m) {
    return [9999, name]
  }
  const v = m[1].toUpperCase()
  if (v === 'X') {
    return [100, name]
  }
  if (v === 'Y') {
    return [101, name]
  }
  if (v === 'M' || v === 'MT') {
    return [102, name]
  }
  return [+v, name]
}

function computeStrandFlip(chains) {
  const tally = new Map()
  for (const c of chains) {
    let t = tally.get(c.qName)
    if (!t) {
      t = { plus: 0, minus: 0 }
      tally.set(c.qName, t)
    }
    const len = c.qEnd - c.qStart
    if (c.qStrand === '+') {
      t.plus += len
    } else {
      t.minus += len
    }
  }
  const flip = new Map()
  for (const [name, { plus, minus }] of tally) {
    flip.set(name, minus > plus)
  }
  return flip
}

function reorderQueryChroms(chains, tOrder, qChrs, tSizes, tileSize) {
  const byT = new Map()
  for (const c of chains) {
    let arr = byT.get(c.tName)
    if (!arr) {
      arr = []
      byT.set(c.tName, arr)
    }
    arr.push(c)
  }
  const order = []
  const seen = new Set()
  for (const tName of tOrder) {
    const cs = byT.get(tName) ?? []
    cs.sort((a, b) => a.tStart - b.tStart)
    const tLen = tSizes.get(tName) ?? 0
    for (let start = 0; start < tLen; start += tileSize) {
      const end = start + tileSize
      const counts = new Map()
      for (const c of cs) {
        if (c.tEnd < start || c.tStart > end) {
          continue
        }
        const overlap = Math.min(c.tEnd, end) - Math.max(c.tStart, start)
        if (overlap > 0) {
          counts.set(c.qName, (counts.get(c.qName) ?? 0) + overlap)
        }
      }
      let best
      let bestVal = 0
      for (const [q, v] of counts) {
        if (v > bestVal) {
          best = q
          bestVal = v
        }
      }
      if (best && qChrs.has(best) && !seen.has(best)) {
        seen.add(best)
        order.push(best)
      }
    }
  }
  for (const q of qChrs) {
    if (!seen.has(q)) {
      order.push(q)
    }
  }
  return order
}

function makeColorPalette(chrs) {
  const colors = new Map()
  const n = chrs.length
  for (const [i, c] of chrs.entries()) {
    const h = (i * 360) / n
    colors.set(c, `hsl(${h}, 70%, 55%)`)
  }
  return colors
}

function render({
  chains,
  tOrder,
  qOrder,
  tSizes,
  qSizes,
  flip,
  outPath,
  topLabel,
  bottomLabel,
  tierLabel,
}) {
  const W = 2400
  const H = 900
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, W, H)

  const marginL = 120
  const marginR = 40
  const trackW = W - marginL - marginR
  const gapFrac = 0.004
  const yTop = 140
  const yBottom = H - 140

  function makeLayout(order, sizes) {
    const total = order.reduce((s, c) => s + (sizes.get(c) ?? 0), 0)
    const gapPx = gapFrac * trackW
    const totalGap = gapPx * Math.max(0, order.length - 1)
    const usableW = trackW - totalGap
    const layout = new Map()
    let x = marginL
    for (const c of order) {
      const size = sizes.get(c) ?? 0
      const w = (size / total) * usableW
      layout.set(c, { x, w, size })
      x += w + gapPx
    }
    return layout
  }
  const topLayout = makeLayout(tOrder, tSizes)
  const bottomLayout = makeLayout(qOrder, qSizes)

  const colors = makeColorPalette(tOrder)

  const sorted = [...chains].sort(
    (a, b) => a.tEnd - a.tStart - (b.tEnd - b.tStart),
  )
  ctx.globalAlpha = 0.25
  for (const c of sorted) {
    const t = topLayout.get(c.tName)
    const q = bottomLayout.get(c.qName)
    if (!t || !q) {
      continue
    }
    const tx1 = t.x + (c.tStart / t.size) * t.w
    const tx2 = t.x + (c.tEnd / t.size) * t.w
    let qs = c.qStart
    let qe = c.qEnd
    if (flip.get(c.qName)) {
      const newS = q.size - c.qEnd
      const newE = q.size - c.qStart
      qs = newS
      qe = newE
    }
    const netInverted = (c.qStrand === '-') !== Boolean(flip.get(c.qName))
    const qxLeft = q.x + (qs / q.size) * q.w
    const qxRight = q.x + (qe / q.size) * q.w
    const qx1 = netInverted ? qxRight : qxLeft
    const qx2 = netInverted ? qxLeft : qxRight

    ctx.fillStyle = colors.get(c.tName) ?? '#888'
    ctx.beginPath()
    const ctrl = (yBottom - yTop) * 0.55
    ctx.moveTo(tx1, yTop)
    ctx.bezierCurveTo(tx1, yTop + ctrl, qx1, yBottom - ctrl, qx1, yBottom)
    ctx.lineTo(qx2, yBottom)
    ctx.bezierCurveTo(qx2, yBottom - ctrl, tx2, yTop + ctrl, tx2, yTop)
    ctx.closePath()
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.fillStyle = '#333'
  for (const c of tOrder) {
    const l = topLayout.get(c)
    ctx.fillRect(l.x, yTop - 8, l.w, 8)
  }
  for (const c of qOrder) {
    const l = bottomLayout.get(c)
    ctx.fillRect(l.x, yBottom, l.w, 8)
  }

  ctx.fillStyle = '#000'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  for (const c of tOrder) {
    const l = topLayout.get(c)
    if (l.w > 14) {
      ctx.fillText(c.replace(/^chr/, ''), l.x + l.w / 2, yTop - 14)
    }
  }
  for (const c of qOrder) {
    const l = bottomLayout.get(c)
    if (l.w > 14) {
      const arrow = flip.get(c) ? ' ←' : ''
      ctx.fillText(c.replace(/^chr/, '') + arrow, l.x + l.w / 2, yBottom + 22)
    }
  }

  ctx.textAlign = 'left'
  ctx.font = 'italic 22px sans-serif'
  ctx.fillStyle = '#000'
  ctx.fillText(topLabel, 12, yTop + 4)
  ctx.fillText(bottomLabel, 12, yBottom + 6)

  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#444'
  ctx.fillText(
    `${tierLabel} • ${chains.length.toLocaleString()} rows, min span ${MIN_BP.toLocaleString()} bp`,
    12,
    H - 12,
  )

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
  console.log(`wrote ${outPath}`)
}

function processOneTier({ rows, tSizes, qSizes, tierLabel, outPath }) {
  console.log(`\n=== ${tierLabel}: ${rows.length.toLocaleString()} rows ===`)
  const filtered = rows.filter(c => c.tEnd - c.tStart >= MIN_BP)
  console.log(
    `  ${filtered.length.toLocaleString()} rows with target span >= ${MIN_BP.toLocaleString()} bp`,
  )

  const tAln = new Map()
  const qAln = new Map()
  for (const c of filtered) {
    tAln.set(c.tName, (tAln.get(c.tName) ?? 0) + (c.tEnd - c.tStart))
    qAln.set(c.qName, (qAln.get(c.qName) ?? 0) + (c.qEnd - c.qStart))
  }
  const tChrs = [...tAln.entries()]
    .filter(([, v]) => v >= MIN_CHR_ALN)
    .map(([k]) => k)
  const qChrs = new Set(
    [...qAln.entries()].filter(([, v]) => v >= MIN_CHR_ALN).map(([k]) => k),
  )
  tChrs.sort((a, b) => {
    const ka = chrSortKey(a)
    const kb = chrSortKey(b)
    if (ka[0] !== kb[0]) {
      return ka[0] - kb[0]
    }
    return ka[1].localeCompare(kb[1])
  })

  const flip = computeStrandFlip(filtered)
  const qOrder = reorderQueryChroms(filtered, tChrs, qChrs, tSizes, 1_000_000)
  const drawable = filtered.filter(
    c => tAln.get(c.tName) >= MIN_CHR_ALN && qAln.get(c.qName) >= MIN_CHR_ALN,
  )
  console.log(`  drawing ${drawable.length.toLocaleString()} ribbons`)

  render({
    chains: drawable,
    tOrder: tChrs,
    qOrder,
    tSizes,
    qSizes,
    flip,
    outPath,
    topLabel: 'hs1',
    bottomLabel: 'mm39',
    tierLabel,
  })
}

async function main() {
  console.log(`reading ${PIF_FILE}...`)
  const { fine, coarse, tSizes, qSizes } = await readPif(PIF_FILE)
  console.log(`  fine: ${fine.length.toLocaleString()} rows`)
  console.log(`  coarse: ${coarse.length.toLocaleString()} rows`)

  processOneTier({
    rows: fine,
    tSizes,
    qSizes,
    tierLabel: 'fine tier (t/q)',
    outPath: `${OUT_PREFIX}-fine.png`,
  })

  if (coarse.length > 0) {
    processOneTier({
      rows: coarse,
      tSizes,
      qSizes,
      tierLabel: 'coarse tier (T/Q)',
      outPath: `${OUT_PREFIX}-coarse.png`,
    })
  } else {
    console.log('\nno coarse (T/Q) tier in file — skipping coarse PNG')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
