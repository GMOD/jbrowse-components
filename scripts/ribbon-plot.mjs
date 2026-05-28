#!/usr/bin/env node
// Wild-experiment: standalone ntSynt-viz-style ribbon plot for a UCSC chain
// file, rendered to PNG via node-canvas. No JBrowse dependencies.
//
// Usage: node scripts/ribbon-plot.mjs <chain.gz> [out.png] [minBp]
//
// Pipeline (mirrors ntSynt-viz at a high level):
//   1. read chain headers only (cheap streaming via `zcat | awk`)
//   2. filter by chain target-span >= minBp (default 100kb)
//   3. drop chromosomes whose total aligned bp falls below MIN_CHR_ALN
//   4. strand-normalize: flip each q-chrom whose bp-weighted dominant
//      orientation is '-', so most ribbons run untwisted
//   5. reorder q-chroms by tile-dominant target-chr (greedy left-to-right)
//   6. paint ribbons by target chromosome (chromosome painting)

import { spawn } from 'child_process'
import readline from 'readline'
import fs from 'fs'
import { createCanvas } from 'canvas'

const CHAIN_FILE = process.argv[2]
const OUT_PNG = process.argv[3] || 'ribbon.png'
const MIN_BP = Number.parseInt(process.argv[4] || '100000', 10)

if (!CHAIN_FILE) {
  console.error('usage: ribbon-plot.mjs <chain.gz> [out.png] [minBp]')
  process.exit(1)
}

const MIN_CHR_ALN = 1_000_000

async function readChainHeaders(file) {
  const sh = spawn('sh', ['-c', `zcat "${file}" | awk '$1=="chain"'`])
  const rl = readline.createInterface({ input: sh.stdout, crlfDelay: Infinity })
  const chains = []
  const tSizes = new Map()
  const qSizes = new Map()
  for await (const line of rl) {
    const f = line.split(/\s+/)
    const tName = f[2]
    const tSize = +f[3]
    const tStart = +f[5]
    const tEnd = +f[6]
    const qName = f[7]
    const qSize = +f[8]
    const qStrand = f[9]
    let qStart = +f[10]
    let qEnd = +f[11]
    if (qStrand === '-') {
      const ns = qSize - qEnd
      const ne = qSize - qStart
      qStart = ns
      qEnd = ne
    }
    chains.push({
      score: +f[1],
      tName,
      tStart,
      tEnd,
      qName,
      qStart,
      qEnd,
      qStrand,
    })
    tSizes.set(tName, tSize)
    qSizes.set(qName, qSize)
  }
  return { chains, tSizes, qSizes }
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
  chrs.forEach((c, i) => {
    const h = (i * 360) / n
    colors.set(c, `hsl(${h}, 70%, 55%)`)
  })
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

  // draw big chains last so they stay legible over the small noise
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
    const netInverted =
      (c.qStrand === '-') !== Boolean(flip.get(c.qName))
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
      ctx.fillText(
        c.replace(/^chr/, '') + arrow,
        l.x + l.w / 2,
        yBottom + 22,
      )
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
    `${chains.length.toLocaleString()} chains, min span ${MIN_BP.toLocaleString()} bp`,
    12,
    H - 12,
  )

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
  console.log(`wrote ${outPath}`)
}

async function main() {
  console.log(`reading ${CHAIN_FILE}...`)
  const { chains, tSizes, qSizes } = await readChainHeaders(CHAIN_FILE)
  console.log(`  ${chains.length.toLocaleString()} chains total`)

  const filtered = chains.filter(c => c.tEnd - c.tStart >= MIN_BP)
  console.log(
    `  ${filtered.length.toLocaleString()} chains with target span >= ${MIN_BP.toLocaleString()} bp`,
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
  console.log(
    `  top ${tChrs.length} chroms, bottom ${qChrs.size} chroms after pruning`,
  )
  console.log(`  top order: ${tChrs.join(' ')}`)

  const flip = computeStrandFlip(filtered)
  const flipped = [...flip.entries()].filter(([, v]) => v).map(([k]) => k)
  console.log(`  flipping ${flipped.length} q-chroms: ${flipped.join(' ')}`)

  const qOrder = reorderQueryChroms(filtered, tChrs, qChrs, tSizes, 1_000_000)
  console.log(`  q order: ${qOrder.join(' ')}`)

  const drawable = filtered.filter(
    c => tAln.get(c.tName) >= MIN_CHR_ALN && qAln.get(c.qName) >= MIN_CHR_ALN,
  )
  console.log(`  drawing ${drawable.length.toLocaleString()} ribbons`)

  // tName=hs1, qName=mm39 for hs1ToMm39.over.chain.gz
  render({
    chains: drawable,
    tOrder: tChrs,
    qOrder,
    tSizes,
    qSizes,
    flip,
    outPath: OUT_PNG,
    topLabel: 'hs1',
    bottomLabel: 'mm39',
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
