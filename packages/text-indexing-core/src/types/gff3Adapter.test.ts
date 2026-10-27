/**
 * @jest-environment node
 */

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { indexGff3 } from './gff3Adapter.ts'

const testDataDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'products',
  'jbrowse-cli',
  'test',
  'data',
)

describe('indexGff3 type gates', () => {
  const gff = path.join(testDataDir, 'volvox.sort.gff3.gz')

  async function types(opts: {
    featureTypesToExclude: string[]
    featureTypesToInclude?: string[]
  }) {
    const seen = new Set<string>()
    for await (const record of indexGff3({
      config: { trackId: 't' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: gff,
      outDir: testDataDir,
      onStart: () => {},
      onUpdate: () => {},
      ...opts,
    })) {
      seen.add(record)
    }
    return seen
  }

  test('an allow list drops every type it does not name', async () => {
    const all = await types({ featureTypesToExclude: [] })
    const genesOnly = await types({
      featureTypesToExclude: [],
      featureTypesToInclude: ['gene'],
    })
    expect(genesOnly.size).toBeGreaterThan(0)
    expect(genesOnly.size).toBeLessThan(all.size)
    for (const record of genesOnly) {
      expect(all.has(record)).toBe(true)
    }
  })

  // The failure this guards is silent: a caller reading the list out of a config
  // gets [] when the slot is unset, and indexing zero features looks exactly
  // like a successful run.
  test('an empty allow list means no allow list, not nothing', async () => {
    expect(
      await types({ featureTypesToExclude: [], featureTypesToInclude: [] }),
    ).toEqual(await types({ featureTypesToExclude: [] }))
  })

  test('both gates apply — include admits, exclude narrows', async () => {
    const included = await types({
      featureTypesToExclude: [],
      featureTypesToInclude: ['gene', 'mRNA'],
    })
    const narrowed = await types({
      featureTypesToExclude: ['mRNA'],
      featureTypesToInclude: ['gene', 'mRNA'],
    })
    expect(narrowed.size).toBeLessThan(included.size)
    for (const record of narrowed) {
      expect(included.has(record)).toBe(true)
    }
  })
})

describe('indexGff3', () => {
  test('indexes a local non-gz gff3 file', async () => {
    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'test-track' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: path.join(testDataDir, 'au9_scaffold_subset_sync.gff3'),
      outDir: testDataDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain('test-track')
  })

  test('indexes a local gz gff3 file', async () => {
    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'test-track-gz' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: path.join(testDataDir, 'volvox.sort.gff3.gz'),
      outDir: testDataDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain('test-track-gz')
  })

  test('skips truncated/malformed lines without throwing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gff3-index-'))
    const file = path.join(tmpDir, 'malformed.gff3')
    // a well-formed feature, then a truncated line missing column 9
    fs.writeFileSync(
      file,
      [
        'ctgA\t.\tgene\t1\t100\t.\t+\t.\tID=gene1;Name=good',
        'ctgA\t.\tgene\t200\t300',
        '',
      ].join('\n'),
    )

    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'malformed-track' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: file,
      outDir: tmpDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })

    expect(results).toHaveLength(1)
    expect(results[0]).toContain('gene1')
  })

  test('a GENCODE row with no Name is named by its own gene_name or transcript_name', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gff3-index-'))
    const file = path.join(tmpDir, 'gencode.gff3')
    const gene = 'gene_id=ENSG1.1;gene_name=DDX11L2'
    const tx = `${gene};transcript_id=ENST1.2;transcript_name=DDX11L2-202`
    fs.writeFileSync(
      file,
      [
        `chr1\tHAVANA\tgene\t11869\t14409\t.\t+\t.\tID=ENSG1.1;${gene}`,
        `chr1\tHAVANA\ttranscript\t11869\t14409\t.\t+\t.\tID=ENST1.2;Parent=ENSG1.1;${tx}`,
        `chr1\tHAVANA\tUTR\t11869\t12000\t.\t+\t.\tID=UTR5:ENST1.2;Parent=ENST1.2;${tx}`,
        '',
      ].join('\n'),
    )

    const words: string[][] = []
    for await (const record of indexGff3({
      config: { trackId: 't' },
      attributesToIndex: ['Name', 'ID', 'symbol'],
      inLocation: file,
      outDir: tmpDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })) {
      words.push(record.trim().split(' ').slice(1))
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })

    expect(words).toEqual([
      ['DDX11L2', 'ENSG1.1'],
      ['DDX11L2-202', 'ENST1.2'],
      ['UTR5:ENST1.2'],
    ])
  })

  describe('each value is indexed on the feature that owns it', () => {
    async function records(lines: string[], attributesToIndex: string[]) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gff3-own-'))
      const file = path.join(tmpDir, 'genes.gff3')
      fs.writeFileSync(file, [...lines, ''].join('\n'))
      const out: { fields: string[]; words: string[] }[] = []
      for await (const record of indexGff3({
        config: { trackId: 't' },
        attributesToIndex,
        inLocation: file,
        outDir: tmpDir,
        featureTypesToExclude: ['exon'],
        onStart: () => {},
        onUpdate: () => {},
      })) {
        const [json, ...words] = record.trim().split(' ')
        const fields = (JSON.parse(json!.replaceAll('|', ',')) as string[]).map(
          decodeURIComponent,
        )
        out.push({ fields: fields.slice(2), words })
      }
      fs.rmSync(tmpDir, { recursive: true, force: true })
      return out
    }

    // the shape a genePred table converted to GFF3 takes: the gene row has only
    // its ID, and every transcript carries the gene's whole synonym list
    const synonyms = 'gene_synonym=BRCAI,BRCC1,FANCS'
    const converted = [
      'chr17\tbed2gff\tgene\t100\t900\t.\t-\t.\tID=BRCA1',
      `chr17\tbed2gff\ttranscript\t100\t800\t.\t-\t.\tID=NM_1;Parent=BRCA1;Name=NM_1;${synonyms}`,
      `chr17\tbed2gff\ttranscript\t100\t700\t.\t-\t.\tID=NM_2;Parent=BRCA1;Name=NM_2;${synonyms}`,
      'chr17\tbed2gff\texon\t100\t200\t.\t-\t.\tID=e1;Parent=NM_1',
    ]

    test('a value every child repeats is indexed once, on the parent', async () => {
      expect(await records(converted, ['Name', 'ID', 'gene_synonym'])).toEqual([
        {
          fields: ['BRCA1', 'BRCAI', 'BRCC1', 'FANCS'],
          words: ['BRCA1', 'BRCAI', 'BRCC1', 'FANCS'],
        },
        { fields: ['NM_1', 'NM_1'], words: ['NM_1'] },
        { fields: ['NM_2', 'NM_2'], words: ['NM_2'] },
      ])
    })

    test('a child stops repeating what its parent already carries', async () => {
      // NCBI's own shape: the synonyms are on the gene; a GENCODE-like child
      // repeating the gene's name drops it
      expect(
        await records(
          [
            `chr17\tRefSeq\tgene\t100\t900\t.\t-\t.\tID=gene-BRCA1;Name=BRCA1;${synonyms}`,
            'chr17\tRefSeq\tmRNA\t100\t800\t.\t-\t.\tID=rna-NM_1;Parent=gene-BRCA1;Name=NM_1;gene_synonym=FANCS;gene=BRCA1',
          ],
          ['Name', 'ID', 'gene_synonym', 'gene'],
        ),
      ).toEqual([
        {
          fields: ['BRCA1', 'gene-BRCA1', 'BRCAI', 'BRCC1', 'FANCS'],
          words: ['BRCA1', 'gene-BRCA1', 'BRCAI', 'BRCC1', 'FANCS'],
        },
        { fields: ['NM_1', 'rna-NM_1'], words: ['NM_1', 'rna-NM_1'] },
      ])
    })

    test('an only child keeps its own name and ID', async () => {
      expect(
        await records(
          [
            'c\tx\tgene\t1\t9\t.\t+\t.\tID=g1;Name=G1',
            'c\tx\tmRNA\t1\t9\t.\t+\t.\tID=t1;Parent=g1;Name=T1;alias=G1-old',
          ],
          ['Name', 'ID', 'alias'],
        ),
      ).toEqual([
        { fields: ['G1', 'g1', 'G1-old'], words: ['G1', 'g1', 'G1-old'] },
        { fields: ['T1', 't1'], words: ['T1', 't1'] },
      ])
    })

    test('a parent on another sequence run is not looked for', async () => {
      // the run closes when the sequence changes, so an unsorted file keeps
      // today's records rather than holding every feature to the end
      const out = await records(
        [
          'c1\tx\tgene\t1\t9\t.\t+\t.\tID=g1',
          'c2\tx\tgene\t1\t9\t.\t+\t.\tID=g2',
          'c1\tx\tmRNA\t1\t9\t.\t+\t.\tID=t1;Parent=g1;alias=A',
        ],
        ['ID', 'alias'],
      )
      expect(out.map(r => r.fields)).toEqual([['g1'], ['g2'], ['t1', 'A']])
    })
  })

  describe('real HTTP server integration', () => {
    let server: http.Server
    let serverPort: number

    beforeAll(done => {
      server = http.createServer((req, res) => {
        const gzFilePath = path.join(testDataDir, 'volvox.sort.gff3.gz')
        const nonGzFilePath = path.join(
          testDataDir,
          'au9_scaffold_subset_sync.gff3',
        )

        if (req.url?.includes('volvox.sort.gff3.gz')) {
          const stat = fs.statSync(gzFilePath)
          res.writeHead(200, {
            'Content-Type': 'application/gzip',
            'Content-Length': stat.size,
          })
          fs.createReadStream(gzFilePath).pipe(res)
        } else if (req.url?.includes('au9_scaffold_subset_sync.gff3')) {
          const stat = fs.statSync(nonGzFilePath)
          res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Length': stat.size,
          })
          fs.createReadStream(nonGzFilePath).pipe(res)
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })
      server.listen(0, () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          serverPort = addr.port
        }
        done()
      })
    })

    afterAll(done => {
      server.close(done)
    })

    test('indexes a remote gz gff3 file from real HTTP server', async () => {
      const results: string[] = []
      const generator = indexGff3({
        config: { trackId: 'remote-gz-track' },
        attributesToIndex: ['ID', 'Name'],
        inLocation: `http://localhost:${serverPort}/volvox.sort.gff3.gz`,
        outDir: testDataDir,
        featureTypesToExclude: [],
        onStart: () => {},
        onUpdate: () => {},
      })

      for await (const record of generator) {
        results.push(record)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toContain('remote-gz-track')
    })

    test('indexes a remote non-gz gff3 file from real HTTP server', async () => {
      const results: string[] = []
      const generator = indexGff3({
        config: { trackId: 'remote-track' },
        attributesToIndex: ['ID', 'Name'],
        inLocation: `http://localhost:${serverPort}/au9_scaffold_subset_sync.gff3`,
        outDir: testDataDir,
        featureTypesToExclude: [],
        onStart: () => {},
        onUpdate: () => {},
      })

      for await (const record of generator) {
        results.push(record)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toContain('remote-track')
    })
  })
})
