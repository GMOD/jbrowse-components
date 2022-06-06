import { renderRegion } from './renderRegion'
import fs from 'fs'
import { JSDOM } from 'jsdom'
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only'

const { document } = new JSDOM(`...`).window
global.document = document

function hashCode(str) {
  let hash = 0
  let chr
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

const timeout = 20000

// commented out for using remote files currently
xtest(
  'renders a region with --session and --config args',
  async () => {
    const result = await renderRegion({
      session: require.resolve('../test/clingen_session.json'),
      config: require.resolve('../data/config.json'),
    })
    fs.writeFileSync('svg_from_config_and_session_param.svg', result)
    expect(hashCode(result)).toMatchSnapshot()
  },
  timeout,
)

// commented out for using remote files currently
xtest(
  'renders a region with --session, --tracks, and --assembly args',
  async () => {
    const result = await renderRegion({
      session: require.resolve('../test/clingen_session.json'),
      tracks: require.resolve('../data/tracks.json'),
      assembly: require.resolve('../data/assembly.json'),
    })
    fs.writeFileSync('svg_from_separate_session_and_tracks.svg', result)
    expect(hashCode(result)).toMatchSnapshot()
  },
  timeout,
)

test(
  'renders volvox with variety of args',
  async () => {
    const fp = f => require.resolve('../data/volvox/' + f)
    console.error = jest.fn()
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
    // can't do a snapshot test here, slightly inconsistent results(?)
    fs.writeFileSync(
      require.resolve('../test/svg_from_volvox_fasta_and_bam.svg'),
      result,
    )
    expect(result).toBeTruthy()
  },
  timeout,
)

test(
  'renders volvox with variety of args (noRasterize)',
  async () => {
    const fp = f => require.resolve('../data/volvox/' + f)
    console.error = jest.fn()
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
    // can't do a snapshot test here, slightly inconsistent results(?)
    fs.writeFileSync(
      require.resolve('../test/svg_from_volvox_fasta_and_bam_norasterize.svg'),
      result,
    )
    expect(result).toBeTruthy()
  },
  timeout,
)

// commented out for using remote files currently
xtest(
  'configtracks arg with urls',
  async () => {
    const result = await renderRegion({
      config: 'data/config.json',
      trackList: [['configtracks', ['ncbi_refseq_109_hg38']]],
      assembly: 'GRCh38',
      loc: 'chr1:50,000-60,000',
    })
    // can't do a snapshot test here, slightly inconsistent results(?)
    fs.writeFileSync('svg_configtracks_simple.svg', result)
    expect(result).toBeTruthy()
  },
  timeout * 3,
)

test(
  'configtracks arg with local files',
  async () => {
    const result = await renderRegion({
      config: require.resolve('../data/volvox/config.json'),
      trackList: [['configtracks', ['volvox_sv']]],
      assembly: 'volvox',
      loc: 'ctgA:1-50,000',
    })
    // can't do a snapshot test here, slightly inconsistent results(?)
    fs.writeFileSync(
      require.resolve('../test/svg_configtracks_local.svg'),
      result,
    )
    expect(result).toBeTruthy()
  },
  timeout * 3,
)

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
  fs.writeFileSync(require.resolve('../test/svg_from_human_hic.svg'), result)
  expect(result).toBeTruthy()
}, 20000)
