/**
 * @jest-environment jsdom
 *
 * The environment rather than `setupEnv()`, whose own JSDOM import drags in an
 * ESM-only dep jest would have to transpile repo-wide.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parseArgv } from '@jbrowse/launch-args'
import { enableStaticRendering } from 'mobx-react'

import { renderRegion } from './renderRegion.ts'

// The rest of setupEnv(): an observer that subscribed would fire after
// destroy() and read a dead MST node.
enableStaticRendering(true)

// jsdom has no `fetch`, and the bgzf wasm loader reads itself from a `data:`
// URL through one. Nothing here touches the network.
global.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  const payload = url.slice(url.indexOf(',') + 1)
  const buf = Buffer.from(
    url.includes(';base64,') ? payload : decodeURIComponent(payload),
    url.includes(';base64,') ? 'base64' : 'utf8',
  )
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}) as unknown as typeof fetch

const vcf = path.join(__dirname, '..', 'data', 'volvox', 'volvox.test.vcf.gz')

const render = (...modifiers: string[]) =>
  renderRegion({
    fasta: path.join(__dirname, '..', 'data', 'volvox', 'volvox.fa'),
    trackList: [
      ['vcf', [vcf, 'display:multivariantmatrix', 'height:300', ...modifiers]],
    ],
    loc: 'ctgA:1-8000',
    width: 800,
    noRasterize: true,
  })

test('runClustering=true waits for the run, so the export draws the dendrogram', async () => {
  const [plain, clustered] = await Promise.all([
    render(),
    render('runClustering=true'),
  ])
  expect(clustered).not.toBe(plain)
}, 120000)

test('runClustering=true with a clusterRegion that names no contig fails the export', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  await expect(
    render('runClustering=true', 'clusterRegion=nosuchcontig:1-100'),
  ).rejects.toThrow(/nosuchcontig/)
  error.mockRestore()
}, 20000)

test('runClustering=true in haplotype mode clusters the phased rows', async () => {
  const [plain, clustered] = await Promise.all([
    render('unit=haplotype'),
    render('unit=haplotype', 'runClustering=true'),
  ])
  expect(clustered).not.toBe(plain)
}, 120000)

test('runClustering=true on one focused row has nothing to cluster and does not wait', async () => {
  const one = ['rows.kept.0=HG00096']
  const [plain, clustered] = await Promise.all([
    render(...one),
    render(...one, 'runClustering=true'),
  ])
  expect(clustered).toBe(plain)
}, 20000)

const testData = path.join(__dirname, '..', '..', '..', 'test_data')

test('runClustering=true on a multi-wiggle waits for the run', async () => {
  const bigWigs = ['v1', 'v2', 'v3', 'v4'].map(n =>
    path.join(testData, 'volvox', `${n}.cram.bw`),
  )
  const render = (...modifiers: string[]) =>
    renderRegion({
      fasta: path.join(__dirname, '..', 'data', 'volvox', 'volvox.fa'),
      trackList: [
        ['multiwig', [bigWigs.join(','), 'height:200', ...modifiers]],
      ],
      loc: 'ctgA:1-8000',
      width: 800,
      noRasterize: true,
    })
  const [plain, clustered] = await Promise.all([
    render(),
    render('runClustering=true'),
  ])
  expect(clustered).not.toBe(plain)
}, 120000)

function mafConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-maf-'))
  const sizes = path.join(dir, 'ce11.chrom.sizes')
  fs.writeFileSync(sizes, 'chrI\t15072434\n')
  const bed = path.join(testData, 'ce11.26way.chrI_subset.bed.gz')
  const file = path.join(dir, 'config.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      assemblies: [
        {
          name: 'ce11',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'ce11-refseq',
            adapter: {
              type: 'ChromSizesAdapter',
              chromSizesLocation: { localPath: sizes },
            },
          },
        },
      ],
      tracks: [
        {
          type: 'MafTrack',
          trackId: 'ce11.26way',
          assemblyNames: ['ce11'],
          adapter: {
            type: 'MafTabixAdapter',
            nhLocation: {
              localPath: path.join(testData, 'ce11.26way.nh'),
            },
            bedGzLocation: { localPath: bed },
            index: { location: { localPath: `${bed}.tbi` } },
          },
        },
      ],
    }),
  )
  return file
}

test('runClustering=true on a MAF with its reference row hidden and one row left does not wait', async () => {
  const config = mafConfig()
  const render = (...modifiers: string[]) => {
    const argv = parseArgv(['--track', 'ce11.26way', ...modifiers])
    return renderRegion({
      config,
      loc: 'chrI:2995942-3000000',
      argv,
      showTracks: argv.filter(([key]) => key === 'track'),
      noRasterize: true,
      width: 800,
    })
  }
  const hidden = ['rows.kept=ce11,cb4', 'alignments.reference.show=false']
  const [plain, clustered] = await Promise.all([
    render(...hidden),
    render(...hidden, 'runClustering=true'),
  ])
  expect(clustered).toBe(plain)
}, 60000)
