import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'

import { createTablesEngine } from './index.ts'
import { GFF3 } from './volvox.fixture.ts'

const engine = createTablesEngine()

// One SH2 domain on EDEN.1, its two blocks in the first two CDS exons
const BED = [
  'ctgA',
  1250,
  3100,
  'SH2',
  0,
  '+',
  1250,
  3100,
  0,
  2,
  '250,100',
  '0,1750',
  'EDEN.1',
].join('\t')

function domainsAdapter(more: string[] = []) {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'pfam-')), 'd.bed')
  writeFileSync(file, `${[BED, ...more].join('\n')}\n`)
  return {
    type: 'BedAdapter',
    bedLocation: { uri: pathToFileURL(file).href, locationType: 'UriLocation' },
    columnNames: [
      'chrom',
      'chromStart',
      'chromEnd',
      'name',
      'score',
      'strand',
      'thickStart',
      'thickEnd',
      'itemRgb',
      'blockCount',
      'blockSizes',
      'blockStarts',
      'transcript',
    ],
  }
}

function domainRects(t: Awaited<ReturnType<typeof engine.features>>) {
  return t.rects.start
    .map((start, i) => ({
      start,
      end: t.rects.end[i],
      color: t.rects.color[i],
    }))
    .filter(r => r.start === 1250 || r.start === 3000)
}

test('the tables draw the proteinFeatures track on its transcript', async () => {
  const display = {
    heightMode: 'grow',
    proteinFeatures: { track: 'pfam', color: { value: '#ff00ff' } },
  }
  const plain = await engine.features({ ...GFF3, display })
  const joined = await engine.features({
    ...GFF3,
    display,
    proteinFeatures: domainsAdapter(),
  })
  expect(joined.rects.start.length).toBe(plain.rects.start.length + 2)
  expect(plain.rects.color).not.toContain('#ff00ff')
  expect(domainRects(joined)).toEqual(
    expect.arrayContaining([
      { start: 1250, end: 1500, color: '#ff00ff' },
      { start: 3000, end: 3100, color: '#ff00ff' },
    ]),
  )
})

test("the domains' color paints by name through its own palette", async () => {
  const t = await engine.features({
    ...GFF3,
    display: { heightMode: 'grow', proteinFeatures: 'pfam' },
    proteinFeatures: domainsAdapter(),
  })
  const sh2 = domainRects(t).filter(r => r.end === 1500 || r.end === 3100)
  expect(sh2).toHaveLength(2)
  expect(sh2[0]!.color).toBe(sh2[1]!.color)
  expect(sh2[0]!.color).not.toBe(NO_CATEGORY_COLOR)
})

test('the tables key the domains apart from the features', async () => {
  const ph = [
    'ctgA',
    5000,
    5400,
    'PH',
    0,
    '+',
    5000,
    5400,
    0,
    1,
    '400',
    '0',
    'EDEN.1',
  ]
  const t = await engine.features({
    ...GFF3,
    display: { heightMode: 'grow', proteinFeatures: 'pfam' },
    proteinFeatures: domainsAdapter([ph.join('\t')]),
  })
  expect(t.domainLegend.label).toEqual(['PH', 'SH2'])
  expect(t.domainLegend.color).toContain(domainRects(t)[0]!.color)
  const plain = await engine.features({ ...GFF3, display: {} })
  expect(plain.domainLegend).toEqual({ label: [], color: [] })
})

test('a domain track that fails fails the tables', async () => {
  const missing = {
    ...domainsAdapter(),
    bedLocation: {
      uri: pathToFileURL(path.join(os.tmpdir(), 'no-such-domains.bed')).href,
      locationType: 'UriLocation',
    },
  }
  await expect(
    engine.features({
      ...GFF3,
      display: { proteinFeatures: 'pfam' },
      proteinFeatures: missing,
    }),
  ).rejects.toThrow(/proteinFeatures:/)
})
