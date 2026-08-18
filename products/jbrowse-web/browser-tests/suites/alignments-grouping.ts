import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const pileup = 'pileup-display'

// Grouping is the widest cross-tier feature in the alignments plugin: the worker
// partitions one fetch into sections (`partitionFeatures`), the main thread
// merges the per-region results into one order (`orderedGroups`), the layout
// hands each lane its own row budget, `zipLaneSections` pairs lanes to bands BY
// INDEX, and the label chips name what the renderer painted. Every tier has unit
// tests, and every one of them hand-builds its input at the seam — no unit test
// runs the real worker, so nothing checks that the chips a reader sees name the
// lanes the reads actually landed in.
//
// These drive the track menu and read the DOM, so what they pin is the picture:
// a partition that filed reverse reads under "Forward strand" would still lay
// out, still paint, and still label.
//
// The two dimensions are chosen against the fixture. At ctgA:1000-2000
// volvox-sorted.bam holds 107 forward / 110 reverse reads, and MAPQ 37 (211
// reads) / 25 (6) — so strand gives two well-populated lanes, and mapq gives
// exactly two whose chips also pin the ordinal key order: the confident bucket
// stacks first, where sorting the labels would put "MAPQ 10-29" there.

async function loadPileup(page: Page) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1000-2000',
        tracks: ['volvox_alignments_pileup_coverage'],
      },
    ],
  })
  await findByTestId(page, pileup, 60000)
  await waitForDataLoaded(page)
  await delay(1000)
}

// Track menu → Group by... → <label>, the route a user takes. The dimension
// radios `keepMenuOpen`, so both the submenu and the track menu are still
// standing afterwards and each needs dismissing — otherwise the next call's
// click on the menu icon lands on the open menu's backdrop instead.
async function groupByMenu(page: Page, label: string) {
  const menuIcon = await findByTestId(page, 'track_menu_icon', 10000)
  await menuIcon.click()
  await delay(300)
  await (await findByText(page, 'Group by...', 10000)).hover()
  await delay(400)
  await (await findByText(page, label, 10000)).click()
  await delay(300)
  await page.keyboard.press('Escape')
  await delay(200)
  await page.keyboard.press('Escape')
  await delay(200)
  await waitForDataLoaded(page)
  await delay(1500)
}

// The section labels, top to bottom — the stacking order as drawn. Reads the
// label text alone: the chip beside it also carries a "Show all reads" button
// whenever that lane's cap clipped something, which is a property of the
// viewport rather than of the grouping.
async function chipLabels(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="group-label-text"]')]
      .map(el => ({
        text: el.textContent.trim(),
        top: el.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top)
      .map(c => c.text),
  )
}

const suite: TestSuite = {
  name: 'Alignments Grouping',
  tests: [
    {
      // Grouping through the menu names its sections on screen, in the order
      // the worker emitted them.
      name: 'grouping by strand draws a chip per lane, forward first',
      fn: async page => {
        await loadPileup(page)
        await groupByMenu(page, 'Strand')

        const labels = await chipLabels(page)
        if (labels.join(' | ') !== 'Forward strand | Reverse strand') {
          throw new Error(`unexpected section chips: ${labels.join(' | ')}`)
        }
      },
    },
    {
      // The ordinal keys, read off the picture: `compareGroupKeys` stacks these
      // by key ('0' then '1'), and nothing else would — sorting the labels puts
      // "MAPQ 10-29" first, which is the confident reads BELOW the poor ones.
      name: 'mapping-quality lanes stack by confidence, not by label',
      fn: async page => {
        await loadPileup(page)
        await groupByMenu(page, 'Mapping quality')

        const labels = await chipLabels(page)
        if (labels.join(' | ') !== 'MAPQ 30+ (high confidence) | MAPQ 10-29') {
          throw new Error(`unexpected section chips: ${labels.join(' | ')}`)
        }
      },
    },
    {
      // The claim the unit tests can't reach: the reads drawn under a chip are
      // the reads that chip names. Sweep down the display, and wherever a read
      // is hovered, the tooltip's own strand marker has to match whichever chip
      // is above it. The hover reads the renderer's hit test and the tooltip
      // reads the read's own record, so a lane holding the wrong reads shows up
      // as the two disagreeing.
      name: 'a hovered read matches the strand its chip claims',
      fn: async page => {
        await loadPileup(page)
        await groupByMenu(page, 'Strand')

        const box = await page.evaluate(() => {
          const el = document.querySelector(
            `[data-testid="pileup-display"] canvas`,
          )!
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        })

        const seen: { chip: string; marker: string }[] = []
        for (let dy = 4; dy < box.height - 4; dy += 4) {
          const clientY = box.y + dy
          await page.mouse.move(box.x + box.width * 0.5, clientY)
          // The tooltip is React state driven off the hover, so it needs a
          // frame or two before it is in the DOM to read.
          await delay(120)
          const hit = await page.evaluate((y: number) => {
            const tip = document.querySelector('[data-testid="pileup-tooltip"]')
            const text = (tip?.textContent ?? '').trim()
            // Only the per-read hover ends in a strand marker; the coverage
            // band's tooltip is a table and matches nothing here.
            const marker = /\(([+-])\)$/.exec(text)?.[1]
            if (marker === undefined) {
              return undefined
            }
            // The chip governing this row is the lowest one at or above the
            // cursor — the same "the chip heads its band" reading a person does.
            const above = [
              ...document.querySelectorAll('[data-testid="group-label-text"]'),
            ]
              .map(el => ({
                text: el.textContent.trim(),
                top: el.getBoundingClientRect().top,
              }))
              .filter(c => c.top <= y)
              .sort((a, b) => b.top - a.top)
            return above[0] ? { chip: above[0].text, marker } : undefined
          }, clientY)
          if (hit) {
            seen.push(hit)
          }
        }

        const expected: Record<string, string> = {
          'Forward strand': '+',
          'Reverse strand': '-',
        }
        const strays = seen.filter(h => expected[h.chip] !== h.marker)
        if (strays.length > 0) {
          throw new Error(
            `reads drawn under the wrong chip: ${strays
              .map(h => `"${h.chip}" holds a (${h.marker}) read`)
              .join('; ')}`,
          )
        }
        // Both lanes hold ~100 reads here, so hitting only one of them means
        // the hit test and the band geometry have come apart.
        if (new Set(seen.map(h => h.chip)).size !== 2) {
          throw new Error(
            `swept the whole display but only hovered reads under ${
              new Set(seen.map(h => h.chip)).size
            } of the two chips`,
          )
        }
      },
    },
    {
      // "None" has to take the chips away, not leave the previous grouping's
      // sections standing over an ungrouped pileup.
      name: 'ungrouping removes the section chips',
      fn: async page => {
        await loadPileup(page)
        await groupByMenu(page, 'Strand')
        if ((await chipLabels(page)).length === 0) {
          throw new Error('grouping drew no chips to remove')
        }

        await groupByMenu(page, 'None')
        const labels = await chipLabels(page)
        if (labels.length > 0) {
          throw new Error(`ungrouped display still shows ${labels.join(' | ')}`)
        }
      },
    },
  ],
}

export default suite
