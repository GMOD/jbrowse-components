#!/usr/bin/env node
/**
 * probe-chords.ts — what a circular view drew, and whether a chord is clickable.
 *
 *   node scripts/probe-chords.ts sv_cgiab/translocation_sv_inspector_view
 *   node scripts/probe-chords.ts <spec> --click=SV_20
 *
 * A chord is a 1px Bezier among hundreds, so "the anchor is wrong" and "the
 * chord is buried under another one" produce the same symptom: a click that
 * opens nothing, or opens the wrong record. This prints every chord's `<title>`
 * (which is what `anchor: { chord }` matches on), and for --click reports the
 * point chordAnchor resolved, what the browser says is at that point, and
 * whether the two agree.
 */
import { parseArgs } from 'node:util'

import { chordPoint } from './chordAnchor.ts'
import {
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'

const PORT = 3347

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    click: { type: 'string' },
    timeout: { type: 'string' },
    settle: { type: 'string' },
  },
})
const specName = positionals[0]
const timeout = Number(values.timeout ?? 300000)
const settle = Number(values.settle ?? 15000)

const spec = resolveUrlSpec(specName, `no url-mode spec named "${specName}"`)

await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await page.goto(specUrl(spec, PORT), {
      waitUntil: 'domcontentloaded',
      timeout,
    })
    await page.waitForSelector('path[data-testid^="chord-"]', { timeout })
    // The chords mount as the VCF streams in, so the first one on screen is not
    // the last one: this is a settle, not a gate.
    await new Promise(r => setTimeout(r, settle))

    const titles = await page.evaluate(() =>
      [
        ...document.querySelectorAll<SVGPathElement>(
          'path[data-testid^="chord-"]',
        ),
      ].map(p => ({
        testid: p.dataset.testid ?? '',
        title: p.querySelector('title')?.textContent ?? '',
      })),
    )
    console.error(`${titles.length} chord(s) drawn`)
    for (const t of titles.slice(0, 40)) {
      console.error(`  ${t.testid.padEnd(14)} ${t.title}`)
    }
    if (titles.length > 40) {
      console.error(`  ... ${titles.length - 40} more`)
    }

    const want = values.click
    if (!want) {
      return
    }
    // What is actually at each sampled point, which is the difference between
    // "the geometry is wrong" and "something is painted over the whole ring".
    const samples = await page.evaluate((label: string) => {
      const paths = [
        ...document.querySelectorAll<SVGPathElement>(
          'path[data-testid^="chord-"]',
        ),
      ]
      const match = paths.find(p =>
        (p.querySelector('title')?.textContent ?? '').includes(label),
      )
      if (!match) {
        return { found: false, rows: [] as string[] }
      }
      const ctm = match.getScreenCTM()
      const total = match.getTotalLength()
      if (!ctm || !total) {
        return { found: true, rows: ['no CTM or zero length'] }
      }
      const rows = [0.12, 0.3, 0.5, 0.7, 0.88].map(t => {
        const pt = match.getPointAtLength(total * t)
        const x = pt.x * ctm.a + pt.y * ctm.c + ctm.e
        const y = pt.x * ctm.b + pt.y * ctm.d + ctm.f
        const el = document.elementFromPoint(x, y)
        const id = (el as HTMLElement | null)?.dataset.testid ?? ''
        const tt = el?.querySelector('title')?.textContent ?? ''
        return `t=${t} (${x.toFixed(1)},${y.toFixed(1)}) -> <${el?.tagName ?? '-'}> ${id} ${tt}`.trim()
      })
      const r = match.getBoundingClientRect()
      rows.push(
        `bbox ${r.left.toFixed(0)},${r.top.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)} strokeWidth=${getComputedStyle(match).strokeWidth} pointerEvents=${getComputedStyle(match).pointerEvents}`,
      )
      return { found: true, rows }
    }, want)
    console.error(`\nsamples for "${want}" (found=${samples.found}):`)
    for (const row of samples.rows) {
      console.error(`  ${row}`)
    }

    const point = await chordPoint(page, { chord: want })
    if (!point) {
      console.error(
        `\nNO CLICKABLE POINT for "${want}".\n` +
          "  Either no chord's title contains it (see the list above), or every\n" +
          '  sampled point along it is covered by another chord.',
      )
      return
    }
    const at = await page.evaluate(
      (x: number, y: number) => {
        const el = document.elementFromPoint(x, y)
        return {
          tag: el?.tagName ?? '(nothing)',
          testid: (el as HTMLElement | null)?.dataset.testid ?? '',
          title: el?.querySelector('title')?.textContent ?? '',
        }
      },
      point.x,
      point.y,
    )
    console.error(
      `\n"${want}" resolves to ${point.x.toFixed(1)},${point.y.toFixed(1)}\n` +
        `  at that point: <${at.tag}> ${at.testid} ${at.title}`,
    )
    // Clicking is the only thing that proves the point is not merely on the
    // right pixel: a chord's handler opens a dialog, so what came up names the
    // record the click reached.
    await page.mouse.click(point.x, point.y)
    await new Promise(r => setTimeout(r, 2500))
    console.error(
      '\nafter the click:',
      await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]')
        return dlg ? dlg.textContent.slice(0, 400) : '(no dialog opened)'
      }),
    )
  },
)
