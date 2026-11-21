import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifyGBK } from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/genbank.ts'
import {
  isSourceRecord,
  sourceRecords,
} from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import GenbankAdapter from './GenbankAdapter.ts'
import configSchema from './configSchema.ts'
import { fetch } from './genbank.fixture.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

jest.mock('../../../../packages/core/src/util/fetchSeq.ts', () => ({
  fetchSeq: jest.fn(async ({ start, end }: { start: number; end: number }) =>
    'A'.repeat(end - start),
  ),
}))

const session = {
  assemblyManager: { get: () => undefined },
} as unknown as AbstractSessionModel

// the Prokka contig with the source qualifiers a plasmid record from NCBI adds
function prokkaPlasmid() {
  const text = fs
    .readFileSync(
      require.resolve('../test_data/prokka_spades_contig.gbk'),
      'utf8',
    )
    .replace(
      '/strain="strain"',
      ['/strain="strain"', '/db_xref="taxon:1639"', '/plasmid="pSPD1"'].join(
        `\n${' '.repeat(21)}`,
      ),
    )
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-export-'))
  const file = path.join(dir, 'prokka_plasmid.gbk')
  fs.writeFileSync(file, text)
  return new GenbankAdapter(
    configSchema.create({ genbankLocation: { localPath: file } }),
  )
}

test("a GenBank record saved as GenBank keeps its source feature's qualifiers", async () => {
  const refName = 'NODE_3_length_3306_cov_210.987654'
  const fetched = (await fetch(prokkaPlasmid(), refName, 0, 3306)).map(
    f => new SimpleFeature(f.toJSON()),
  )
  const exported = await stringifyGBK({
    features: fetched.filter(f => !isSourceRecord(f)),
    sourceRecords: sourceRecords(fetched),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'spades',
    session,
  })
  const lines = exported.split('\n')
  expect(
    lines.slice(
      lines.findIndex(line => line.startsWith('SOURCE')),
      lines.findIndex(line => line.startsWith('     CDS')),
    ),
  ).toEqual([
    'SOURCE      Genus species',
    '  ORGANISM  Genus species',
    '            .',
    'FEATURES             Location/Qualifiers',
    '     source          1..2357',
    '                     /organism="Genus species"',
    '                     /mol_type="genomic DNA"',
    '                     /strain="strain"',
    '                     /db_xref="taxon:1639"',
    '                     /plasmid="pSPD1"',
  ])
  expect(exported).not.toContain('/chromosome=')
  expect(exported).not.toContain('misc_feature')
})
