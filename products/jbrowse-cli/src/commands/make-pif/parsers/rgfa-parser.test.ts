import path from 'path'

import { parseRgfa } from './rgfa-parser.ts'
import { recordsToPafLines } from './to-paf.ts'

const gfaPath = path.resolve(
  __dirname,
  '../../../../../../test/data/synteny-demo/synthetic/synthetic_4genome.gfa',
)

describe('parseRgfa', () => {
  it('extracts pairwise synteny from GFA P-lines with segment IDs', async () => {
    const records = await parseRgfa(gfaPath)
    expect(records.length).toBeGreaterThan(0)

    // Every record from GFA should have a segmentId
    for (const r of records) {
      expect(r.segmentId).toBeDefined()
    }

    // Check that segment IDs reference actual GFA segment names
    const firstRecord = records[0]!
    expect(firstRecord.segmentId).toMatch(/^s\d+/)
  })

  it('includes sg:Z: tag in PAF output', async () => {
    const records = await parseRgfa(gfaPath)
    const lines = recordsToPafLines(records)

    const linesWithSg = lines.filter(l => l.includes('sg:Z:'))
    expect(linesWithSg.length).toBe(lines.length)
  })

  it('supports all-vs-all pair mode', async () => {
    const adjacent = await parseRgfa(gfaPath, undefined, 'adjacent')
    const allVsAll = await parseRgfa(gfaPath, undefined, 'all')
    expect(allVsAll.length).toBeGreaterThan(adjacent.length)
  })
})
