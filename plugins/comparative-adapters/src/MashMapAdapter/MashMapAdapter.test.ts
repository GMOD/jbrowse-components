import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter, { parseMashMapLine } from './MashMapAdapter.ts'
import configSchema from './configSchema.ts'

// mashmap ≤2: space delimited, last column is the estimated identity percentage
const LEGACY_LINE = 'q1 1000 100 200 - t1 2000 300 400 98.75'

describe('parseMashMapLine', () => {
  test('reads the legacy space-delimited line as identity, not mapping quality', () => {
    const r = parseMashMapLine(LEGACY_LINE)
    expect(r).toMatchObject({
      qname: 'q1',
      qstart: 100,
      qend: 200,
      tname: 't1',
      tstart: 300,
      tend: 400,
      strand: -1,
    })
    expect(r.extra.de).toBeCloseTo(0.0125)
    expect(r.extra).not.toHaveProperty('mappingQual')
  })

  test('reads an identity column written as a fraction', () => {
    expect(
      parseMashMapLine('q1 1000 100 200 + t1 2000 300 400 0.9875').extra.de,
    ).toBeCloseTo(0.0125)
  })

  test('reads mashmap3 PAF output', () => {
    const r = parseMashMapLine(
      'q1\t1000\t100\t200\t+\tt1\t2000\t300\t400\t95\t100\t60\tid:f:0.98',
    )
    expect(r.qstart).toBe(100)
    expect(r.tstart).toBe(300)
    expect(r.extra.mappingQual).toBe(60)
    expect(r.extra.id).toBe('0.98')
  })

  test('rejects a line missing the identity column', () => {
    expect(() => parseMashMapLine('q1 1000 100 200 + t1 2000 300')).toThrow(
      /improperly formatted/,
    )
  })
})

test('identity from the mashmap file reaches the feature', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'mashmap-')), 'aln.out')
  writeFileSync(path, `${LEGACY_LINE}\n`)
  const adapter = new Adapter(
    configSchema.create({
      outLocation: { localPath: path, locationType: 'LocalPathLocation' },
      assemblyNames: ['q', 't'],
    }),
  )
  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 't1',
        start: 0,
        end: 1000,
        assemblyName: 't',
      })
      .pipe(toArray()),
  )
  expect(feats.length).toBe(1)
  // 98.75% arrives as a [0,1] identity on the same scale the color ramp uses,
  // where the old mappingQual reading left it at 0
  expect(feats[0]!.get('identity')).toBeCloseTo(0.9875)
  expect(feats[0]!.get('mappingQual')).toBeUndefined()
})
