/* eslint-disable tsdoc/syntax */
/**
 * @jest-environment node
 */

// the above jest-environment node is important to check true usage
// as a CLI tool

import { renderRegion } from './renderRegion'
import path from 'path'
import fs from 'fs'
import { JSDOM } from 'jsdom'
import { Image, createCanvas } from 'canvas'
import fetch, { Headers, Response, Request } from 'node-fetch'

// @ts-expect-error
global.fetch = fetch
// @ts-expect-error
global.Headers = Headers
// @ts-expect-error
global.Response = Response
// @ts-expect-error
global.Request = Request

const { document } = new JSDOM(`...`).window
global.document = document

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

function pa(s: string) {
  return path.join(__dirname, s)
}

xtest('renders a region with --session and --config args', async () => {
  const result = await renderRegion({
    session: pa('../test/clingen_session.json'),
    config: pa('../data/config.json'),
  })
  fs.writeFileSync('svg_from_config_and_session_param.svg', result)
  expect(result).toMatchSnapshot()
}, 40000)

xtest('renders a region with --session, --tracks, and --assembly args', async () => {
  const result = await renderRegion({
    session: pa('../test/clingen_session.json'),
    tracks: pa('../data/tracks.json'),
    assembly: pa('../data/assembly.json'),
  })
  fs.writeFileSync('svg_from_separate_session_and_tracks.svg', result)
  expect(result).toMatchSnapshot()
}, 40000)

test('renders volvox with variety of args', async () => {
  const fp = (f: string) => pa('../data/volvox/' + f)
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [
      ['bam', [fp('volvox-sorted.bam')]],
      ['cram', [fp('volvox-sorted.cram')]],
      ['bigwig', [fp('volvox-sorted.bam.coverage.bw')]],
      ['vcfgz', [fp('volvox.filtered.vcf.gz')]],
      ['gffgz', [fp('volvox.sort.gff3.gz')]],
      ['bigbed', [fp('volvox.bb')]],
      ['bedgz', [fp('volvox-bed12.bed.gz')]],
    ],
    loc: 'ctgA:1000-2000',
  })
  fs.writeFileSync(pa('../test/svg_from_volvox_fasta_and_bam.svg'), result)
  expect(result).toBeTruthy()
}, 40000)

xtest('renders human large region with remote urls', async () => {
  const result = await renderRegion({
    fasta: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    trackList: [
      [
        'cram',
        [
          'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/skbr3/skbr3.ont.sort.mod.cram',
          'force:true',
        ],
      ],
    ],
    loc: '1:10,000,000-10,030,000',
  })
  fs.writeFileSync(pa('../test/human_remote_urls_large_region.svg'), result)
  expect(result).toBeTruthy()
}, 120000)

xtest('renders volvox with remote urls', async () => {
  const result = await renderRegion({
    fasta: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.fa',
    trackList: [
      [
        'bam',
        [
          'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
        ],
      ],
    ],
    loc: 'ctgA:1-1000',
  })
  fs.writeFileSync(pa('../test/volvox_remote_region.svg'), result)
  expect(result).toBeTruthy()
}, 20000)

test('renders volvox with variety of args (noRasterize)', async () => {
  const fp = (f: string) => pa('../data/volvox/' + f)
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [
      ['bam', [fp('volvox-sorted.bam')]],
      ['cram', [fp('volvox-sorted.cram')]],
      ['bigwig', [fp('volvox-sorted.bam.coverage.bw')]],
      ['vcfgz', [fp('volvox.filtered.vcf.gz')]],
      ['gffgz', [fp('volvox.sort.gff3.gz')]],
      ['bigbed', [fp('volvox.bb')]],
      ['bedgz', [fp('volvox-bed12.bed.gz')]],
    ],
    loc: 'ctgA:1000-2000',
    noRasterize: true,
  })
  fs.writeFileSync(
    pa('../test/svg_from_volvox_fasta_and_bam_norasterize.svg'),
    result,
  )
  expect(result).toBeTruthy()
}, 40000)

// commented out for using remote files currently
xtest('configtracks arg with urls', async () => {
  const result = await renderRegion({
    config: 'data/config.json',
    trackList: [['configtracks', ['ncbi_refseq_109_hg38']]],
    assembly: 'GRCh38',
    loc: 'chr1:50,000-60,000',
  })
  fs.writeFileSync('svg_configtracks_simple.svg', result)
  expect(result).toBeTruthy()
}, 40000)

test('configtracks arg with local files', async () => {
  const result = await renderRegion({
    config: pa('../data/volvox/config.json'),
    trackList: [['configtracks', ['volvox_sv']]],
    assembly: 'volvox',
    loc: 'ctgA:1-50,000',
  })
  fs.writeFileSync(pa('../test/svg_configtracks_local.svg'), result)
  expect(result).toBeTruthy()
}, 40000)

xtest('renders --hic', async () => {
  const result = await renderRegion({
    fasta: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    trackList: [
      [
        'hic',
        [
          'https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic',
        ],
      ],
    ],
    loc: '1:2,000,000-10,000,000',
  })
  fs.writeFileSync(pa('../test/svg_from_human_hic.svg'), result)
  expect(result).toBeTruthy()
}, 20000)
