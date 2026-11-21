/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { indexFiles } from '../indexFiles.ts'
import { defaultAttributesToIndex, defaultIndexingPolicy } from '../util.ts'
import { guessAdapterFromFileName } from './common.ts'
import { indexGenbank } from './genbankAdapter.ts'

// a trix .ix input line is `<record id> <word> <word>...`
function loc(line: string) {
  return decodeURIComponent(line.slice(2, line.indexOf('"|"')))
}
function words(line: string) {
  return line.trim().split(' ').slice(1)
}

// an NCBI record, where a gene and its CDS share a /locus_tag, then a Prokka
// one, a CDS with no gene above it and a contig name run into the length
const genbank = `LOCUS       NC_002128              92721 bp    DNA     circular CON 28-AUG-2016
VERSION     NC_002128.1
FEATURES             Location/Qualifiers
     source          1..92721
                     /organism="Escherichia coli O157:H7 str. Sakai"
     gene            16612..19608
                     /gene="hlyA"
                     /locus_tag="ECO57_RS28565"
     CDS             16612..19608
                     /gene="hlyA"
                     /locus_tag="ECO57_RS28565"
                     /product="enterohemolysin"
     misc_feature    complement(join(30001..30100,30201..30300))
                     /note="no name to find it by"
ORIGIN
//
LOCUS       NODE_3_length_3306_cov_210.9876543306 bp   DNA linear
21-NOV-2026
FEATURES             Location/Qualifiers
     source          1..3306
     CDS             complement(971..1351)
                     /gene="lsoB"
                     /locus_tag="SPD_00090"
                     /product="Antitoxin LsoB"
//
`

describe('indexGenbank', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-index-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  async function index(file: string) {
    const results: string[] = await Array.fromAsync(
      indexGenbank({
        config: { trackId: 'gbk' },
        attributesToIndex: defaultAttributesToIndex,
        inLocation: file,
        outDir: tmpDir,
        onStart: () => {},
        onUpdate: () => {},
      }),
    )
    return results.map(line => ({ loc: loc(line), words: words(line) }))
  }

  test('a gene and its CDS are one hit, a Prokka CDS another, under the adapter’s refNames', async () => {
    const file = path.join(tmpDir, 'sakai.gbk')
    fs.writeFileSync(file, genbank)
    expect(await index(file)).toEqual([
      {
        loc: 'NC_002128.1:16612..19608',
        words: ['hlyA', 'ECO57_RS28565'],
      },
      {
        loc: 'NODE_3_length_3306_cov_210.987654:971..1351',
        words: ['lsoB', 'SPD_00090'],
      },
    ])
  })

  test('a GenbankAdapter track in a config is indexed, not skipped', async () => {
    const file = path.join(tmpDir, 'sakai.gbk')
    fs.writeFileSync(file, genbank)
    const lines: string[] = await Array.fromAsync(
      indexFiles({
        tracks: [
          {
            trackId: 'gbk',
            adapter: {
              type: 'GenbankAdapter',
              genbankLocation: {
                localPath: file,
                locationType: 'LocalPathLocation',
              },
            },
          },
        ],
        policy: defaultIndexingPolicy,
        outDir: tmpDir,
      }),
    )
    expect(lines.map(words)).toEqual([
      ['hlyA', 'ECO57_RS28565'],
      ['lsoB', 'SPD_00090'],
    ])
  })

  test('text-index --file reads a .gbk as a GenBank track', () => {
    expect(guessAdapterFromFileName('/data/sakai.gbk').adapter).toEqual({
      type: 'GenbankAdapter',
      genbankLocation: {
        localPath: '/data/sakai.gbk',
        locationType: 'LocalPathLocation',
      },
    })
  })
})
