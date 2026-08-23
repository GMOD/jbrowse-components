import fs from 'node:fs'

import { act, fireEvent, render } from '@testing-library/react'

import SequencePanel from './SequencePanel.tsx'
import { SequenceFeatureDetailsF } from './model.ts'
import DLGAP3 from './test_data/DLGAP3.ts'
import NCDN from './test_data/NCDN.ts'
import { getSequenceFasta } from './util.ts'

import type { SimpleFeatureSerializedNoId } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'
import type { SequenceDisplayMode, SequenceHoverPosition } from './model.ts'

// What the panel puts on screen, which is not what `getSequenceFasta` exports:
// the rendered rows carry their coordinate label and the space every ten bases,
// and the FASTA deliberately carries neither. An assertion about layout reads
// these; an assertion about the file reads the export.
function renderedRow(panel: HTMLElement, index: number) {
  return panel.textContent.split('\n')[index]
}

function renderedRowStarts(panel: HTMLElement) {
  return [...panel.querySelectorAll('[data-no-fasta="coord"]')].map(
    el => +el.textContent.trim(),
  )
}

// the sequence spans, i.e. not the coordinate labels the panel draws beside
// them — both are <span> and the label comes first in the row
const SEQ_SPAN = 'span:not([data-no-fasta])'

// the panel publishes hovered bases to whoever opened it (a feature-detail
// widget, a track's sequence dialog); tests stand in a plain recorder
function makeHoverTarget() {
  const positions: (SequenceHoverPosition | undefined)[] = []
  return {
    get position() {
      return positions.at(-1)
    },
    setSequenceHoverPosition(pos: SequenceHoverPosition | undefined) {
      positions.push(pos)
    },
  }
}

// Usage reference for the public SequencePanel component (it has external
// consumers): each test below renders <SequencePanel> with a different mode and
// coordinate setting, showing how to wire up the model, sequence, and feature
// props.

afterEach(() => {
  localStorage.clear()
})

const f = {
  start: 1200,
  end: 1500,
  refName: 'chr1',
  strand: 1,
  type: 'mRNA',
  uniqueId: 'unique',
  name: 'made_up',
  subfeatures: [
    { refName: 'chr1', start: 1200, end: 1500, type: 'exon' },
    { refName: 'chr1', start: 1200, end: 1500, type: 'CDS' },
  ],
}

const readFasta = (filename: string) => {
  return fs
    .readFileSync(require.resolve(filename), 'utf8')
    .split(/\n|\r\n|\r/)
    .slice(1)
    .join('')
}

test('test using the sequence feature panel', () => {
  // produced from uniprot
  // https://www.uniprot.org/uniprot/O95886.fasta
  const pep = readFasta('./test_data/DLGAP3_pep.fa')

  // produced with samtools faidx
  // 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz'
  // 1:35331037..35395251
  const dna = readFasta('./test_data/DLGAP3_dna.fa')

  // http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-zMPjiv36k0&password=ddxCy
  const feature = DLGAP3
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="protein"
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]!}
    />,
  )

  const element = getByTestId('sequence_panel')

  // https://m.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000116544;r=1:34865436-34929650
  // with stop codon on the end
  expect(
    element.textContent
      .split('\n')
      .slice(1)
      .map(s => s.trim())
      .join(''),
  ).toEqual(`${pep}*`)
})

test('test using the sequence feature panel with show coords', () => {
  // produced from uniprot
  // https://www.uniprot.org/uniprot/O95886.fasta
  const pep = readFasta('./test_data/DLGAP3_pep.fa')

  // produced with samtools faidx
  // 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz'
  // 1:35331037..35395251
  const dna = readFasta('./test_data/DLGAP3_dna.fa')

  const model = SequenceFeatureDetailsF().create()
  const feature = DLGAP3
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="protein"
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]!}
    />,
  )

  const element = getByTestId('sequence_panel')
  // make sure show coords shows the expected sequence as well
  expect(
    element.textContent
      .split('\n')
      .slice(1)
      .map(s => s.trim().split(/\s+/).slice(1).join(''))
      .join(''),
  ).toEqual(`${pep}*`)
})

test('NCDN collapsed intron', () => {
  // samtools faidx 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz' 1:36,023,400-36,032,380 > out.fa
  const dna = readFasta('./test_data/NCDN_dna.fa')

  // http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-zMPjiv36k0&password=ddxCy
  const feature = NCDN
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene_collapsed_intron"
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]!}
    />,
  )

  const element = getByTestId('sequence_panel')

  // UTR
  expect(getSequenceFasta(element)).toMatchSnapshot()
})

test('NCDN updownstream', () => {
  // produced from uniprot
  // https://www.uniprot.org/uniprot/O95886.fasta
  const upstream = readFasta('./test_data/NCDN_upstream_dna.fa')

  // samtools faidx 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz' 1:36,023,400-36,032,380 > out.fa
  const seq = readFasta('./test_data/NCDN_dna.fa')

  // http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-zMPjiv36k0&password=ddxCy
  const feature = NCDN
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene_updownstream"
      sequence={{ seq, upstream }}
      feature={feature.subfeatures[0]!}
    />,
  )

  const element = getByTestId('sequence_panel')
  expect(getSequenceFasta(element)).toMatchSnapshot()
})

test('updownstream annotation shown in header for collapsed-intron+flanks mode', () => {
  // gene_updownstream_collapsed_intron contains but does not end with
  // "updownstream"; the header must still note the flanks it renders
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene_updownstream_collapsed_intron"
      sequence={{ seq, upstream: 'ACGT', downstream: 'ACGT' }}
      feature={f}
    />,
  )
  const header = getByTestId('sequence_panel').textContent.split('\n')[0]!
  expect(header).toContain('up/downstream bp')
})

test('the legend is stripped so it does not corrupt FASTA output', () => {
  const el = document.createElement('div')
  el.innerHTML =
    '<div data-no-fasta>legend note: selenocysteine</div>' +
    '<pre>&gt;made_up\nACGTACGT</pre>'
  expect(getSequenceFasta(el)).toEqual('>made_up\nACGTACGT')
})

// The property the export exists for, and the one the panel's own text cannot
// have: with coordinates on, the panel draws `1201   ACGTACGTAC ACGT…` down the
// page, and a `.fa` whose lines read that way parses nowhere.
test('the export is FASTA even with coordinates on', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      sequence={{ seq: 'ACGT'.repeat(75) }}
      feature={{
        start: 1200,
        end: 1500,
        refName: 'chr1',
        strand: 1,
        type: 'region',
        uniqueId: 'fwd',
        name: 'fwd',
      }}
    />,
  )
  const panel = getByTestId('sequence_panel')
  // the labels are on screen
  expect(panel.textContent).toContain('1201   ')

  const [header, ...body] = getSequenceFasta(panel).split('\n')
  expect(header).toBe('>fwd-genomic chr1:1,201-1,500(+)')
  expect(body.filter(Boolean)).toEqual([
    'ACGT'.repeat(25),
    'ACGT'.repeat(25),
    'ACGT'.repeat(25),
  ])
})

test('single exon cDNA should not have duplicate sequences', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel model={model} mode="cdna" sequence={{ seq }} feature={f} />,
  )

  const element = getByTestId('sequence_panel')

  expect(
    getSequenceFasta(element)
      .split('\n')
      .slice(1)
      .map(s => s.trim())
      .join(''),
  ).toEqual(
    'ATGTCACCTCGGGTACTGCCTCTATTACAGAGGTATCTTAATGGCGCATCCAGCCTTGTGGCTGGGTCTACGTACGCGTGGGCACCATACGTATGTTGGCAGGAAAGGTCAATCATGCTTGTTTCCTCGTCGCAGAAACGTTCACACTATTGGCTCGCGGGATCGAACGGGCCTGATTATTTTTCCAGCTCCTGCGTTCCTATCACGCCAACTGTCGCTAATAAAATGTTATATAGAGATAACCCATTGCTATGCAAGGATGGAGAAACCGCTTCACAACACCCTAGAATTACTTCAGCA',
  )
})

test('single exon cDNA display genomic coords', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel model={model} mode="gene" sequence={{ seq }} feature={f} />,
  )

  const element = getByTestId('sequence_panel')
  expect(getSequenceFasta(element)).toMatchSnapshot()
})

test('reverse strand genomic coords count down across rows', () => {
  const seq = 'ACGT'.repeat(75) // 300bp, 3 rows at 100/row
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const revFeature = {
    start: 0,
    end: 300,
    refName: 'chr1',
    strand: -1,
    type: 'region',
    uniqueId: 'rev',
    name: 'rev',
  }
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      sequence={{ seq }}
      feature={revFeature}
    />,
  )

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  // reverse strand genomic coordinates must decrement, not increment
  expect(rowStarts).toEqual([300, 200, 100])
})

test('switching relative to genomic coordinates updates the row labels', () => {
  // the model's showCoordinates getter is the same `true` either side of this
  // switch, so only a component reading the tri-state setting itself sees it;
  // reading it outside an observer left the panel rendering relative rows while
  // the menu radio said genomic
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene"
      sequence={{ seq: 'A'.repeat(300) }}
      feature={f}
    />,
  )
  act(() => {
    model.setShowCoordinates('genomic')
  })

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  expect(rowStarts).toEqual([1201, 1301, 1401])
})

test('a sticky genomic setting renders relative coords in cDNA mode', () => {
  // the setting is global and persisted, so it outlives the mode it was chosen
  // in; cDNA is spliced and cannot label genomic positions, so it must fall
  // back to relative rather than mislabel rows as genomic
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="cdna"
      sequence={{ seq: 'A'.repeat(300) }}
      feature={f}
    />,
  )

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  // relative to the feature start, not the genomic 1200
  expect(rowStarts).toEqual([0, 100, 200])
})

test('reverse strand rows break where a flank leaves a row half filled', () => {
  // the 150bp display upstream flank fills row 0 and half of row 1; the 50bp
  // feature completes row 1, which must still end in a newline so the
  // downstream flank starts its own row
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic_sequence_updownstream"
      sequence={{
        seq: 'A'.repeat(50),
        upstream: 'C'.repeat(150),
        downstream: 'G'.repeat(150),
      }}
      feature={{
        start: 1000,
        end: 1050,
        refName: 'chr1',
        strand: -1,
        type: 'region',
        uniqueId: 'rev',
        name: 'rev',
      }}
    />,
  )

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  // feature end 1050 + 150bp flank => first label 1200, counting down
  expect(rowStarts).toEqual([1200, 1100, 1000, 900])
})

test('genomic coords thread continuously across the upstream flank boundary', () => {
  // 100bp upstream flank fills row 0, then the 300bp feature fills rows 1-3.
  // Row labels must count from the flank start (feature.start+1 - flankLen) and
  // stay continuous across the flank->feature segment boundary.
  const seq = 'A'.repeat(300)
  const upstream = 'C'.repeat(100)
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene_updownstream"
      sequence={{ seq, upstream }}
      feature={f}
    />,
  )

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  // feature starts at 1200 (1-based 1201); 100bp upstream => first label 1101
  expect(rowStarts).toEqual([1101, 1201, 1301, 1401])
})

// a 100bp single row rendered with genomic coordinate spacing is 109 chars
// wide (9 spaces, before each multiple of 10); mocking the span at 1090px makes
// each visible column 10px, and columns 0-9 carry no spacing space so
// clientX/10 maps straight to the sequence index there
function mockRowRect(span: Element) {
  return jest.spyOn(span, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width: 1090,
    right: 1090,
    top: 0,
    bottom: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

test('hovering the genomic sequence reports the genomic base under the cursor', () => {
  const model = SequenceFeatureDetailsF().create()
  const hover = makeHoverTarget()
  model.setShowCoordinates('genomic')
  const feature = {
    start: 1200,
    end: 1300,
    refName: 'chr1',
    strand: 1,
    type: 'region',
    uniqueId: 'fwd',
    name: 'fwd',
  }
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      hoverTarget={hover}
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      feature={feature}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector(SEQ_SPAN)!
  const rectSpy = mockRowRect(span)

  // cursor at the row start => first feature base (0-based 1200)
  fireEvent.mouseMove(span, { clientX: 0 })
  expect(hover.position).toEqual({
    refName: 'chr1',
    start: 1200,
    end: 1201,
  })

  // 5.5 columns in => 6th base (0-based 1205)
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(hover.position).toEqual({
    refName: 'chr1',
    start: 1205,
    end: 1206,
  })

  fireEvent.mouseLeave(getByTestId('sequence_panel'))
  expect(hover.position).toBeUndefined()
  rectSpy.mockRestore()
})

test('hovering a reverse-strand genomic sequence counts positions down', () => {
  const model = SequenceFeatureDetailsF().create()
  const hover = makeHoverTarget()
  model.setShowCoordinates('genomic')
  const feature = {
    start: 0,
    end: 100,
    refName: 'chr1',
    strand: -1,
    type: 'region',
    uniqueId: 'rev',
    name: 'rev',
  }
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      hoverTarget={hover}
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      feature={feature}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector(SEQ_SPAN)!
  const rectSpy = mockRowRect(span)

  // display char 0 is the last genomic base (0-based 99)
  fireEvent.mouseMove(span, { clientX: 0 })
  expect(hover.position).toEqual({ refName: 'chr1', start: 99, end: 100 })

  // 5 columns in counts down to base 94
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(hover.position).toEqual({ refName: 'chr1', start: 94, end: 95 })
  rectSpy.mockRestore()
})

test('hovering does not report positions when coordinates are not genomic', () => {
  const model = SequenceFeatureDetailsF().create()
  const hover = makeHoverTarget()
  model.setShowCoordinates('relative')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      hoverTarget={hover}
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      feature={{
        start: 1200,
        end: 1300,
        refName: 'chr1',
        strand: 1,
        type: 'region',
        uniqueId: 'rel',
        name: 'rel',
      }}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector(SEQ_SPAN)!
  const rectSpy = mockRowRect(span)
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(hover.position).toBeUndefined()
  rectSpy.mockRestore()
})

// 400bp single-exon transcript: 100bp 5'UTR, 200bp CDS, 100bp 3'UTR
const utrSeq = `${'a'.repeat(100)}${'C'.repeat(200)}${'g'.repeat(100)}`
const utrFeature = (subfeatures: SimpleFeatureSerializedNoId[]) => ({
  start: 1000,
  end: 1400,
  refName: 'chr1',
  strand: 1,
  type: 'mRNA',
  uniqueId: 'utrs',
  name: 'utrs',
  subfeatures,
})

const renderCdna = (subfeatures: SimpleFeatureSerializedNoId[]) => {
  const { getByTestId } = render(
    <SequencePanel
      model={SequenceFeatureDetailsF().create()}
      mode="cdna"
      sequence={{ seq: utrSeq }}
      feature={utrFeature(subfeatures)}
    />,
  )
  return getSequenceFasta(getByTestId('sequence_panel')).split('\n')[1]
}

test.each([
  [
    'no UTRs annotated',
    [
      { refName: 'chr1', start: 1000, end: 1400, type: 'exon' },
      { refName: 'chr1', start: 1100, end: 1300, type: 'CDS' },
    ],
  ],
  [
    // the un-annotated side has to be derived too, or it drops out of the cDNA
    'only the 5prime UTR annotated',
    [
      { refName: 'chr1', start: 1000, end: 1400, type: 'exon' },
      { refName: 'chr1', start: 1000, end: 1100, type: 'five_prime_UTR' },
      { refName: 'chr1', start: 1100, end: 1300, type: 'CDS' },
    ],
  ],
  [
    'both UTRs annotated',
    [
      { refName: 'chr1', start: 1000, end: 1400, type: 'exon' },
      { refName: 'chr1', start: 1000, end: 1100, type: 'five_prime_UTR' },
      { refName: 'chr1', start: 1100, end: 1300, type: 'CDS' },
      { refName: 'chr1', start: 1300, end: 1400, type: 'three_prime_UTR' },
    ],
  ],
  [
    // more CDS blocks than exons: no UTR can be derived from this pairing, and
    // the annotation only covers one side, so anything trusting either would
    // drop the 3' end
    'more CDS blocks than exons and a partial annotation',
    [
      { refName: 'chr1', start: 1000, end: 1400, type: 'exon' },
      { refName: 'chr1', start: 1000, end: 1100, type: 'five_prime_UTR' },
      { refName: 'chr1', start: 1100, end: 1200, type: 'CDS' },
      { refName: 'chr1', start: 1200, end: 1300, type: 'CDS' },
    ],
  ],
])('cDNA spans the whole transcript with %s', (_, subfeatures) => {
  expect(renderCdna(subfeatures)).toBe(utrSeq)
})

// A 400bp minus-strand transcript, 50bp of 3'UTR / 200bp CDS / 150bp of 5'UTR
// in genomic order. Read 5'->3' the transcript is the reverse complement, so
// the cDNA is 150 lowercase UTR, 200 uppercase CDS, then 50 lowercase UTR.
const revSeq = `${'A'.repeat(50)}${'C'.repeat(200)}${'G'.repeat(150)}`
const revCdna = `${'c'.repeat(150)}${'G'.repeat(200)}${'t'.repeat(50)}`
const revFeat = (subfeatures: SimpleFeatureSerializedNoId[]) => ({
  start: 1000,
  end: 1400,
  refName: 'chr1',
  strand: -1,
  type: 'mRNA',
  uniqueId: 'rev',
  name: 'rev',
  subfeatures,
})

test.each([
  [
    'with the exon annotated',
    [
      { refName: 'chr1', start: 1000, end: 1400, type: 'exon' },
      { refName: 'chr1', start: 1050, end: 1250, type: 'CDS' },
    ],
  ],
  [
    // no exon: the CDS block stands in for it, stretched to the feature bounds.
    // Renders identically to the annotated case
    'with only the CDS annotated',
    [{ refName: 'chr1', start: 1050, end: 1250, type: 'CDS' }],
  ],
])('minus-strand cDNA is the reverse complement %s', (_, subfeatures) => {
  const { getByTestId } = render(
    <SequencePanel
      model={SequenceFeatureDetailsF().create()}
      mode="cdna"
      sequence={{ seq: revSeq }}
      feature={revFeat(subfeatures)}
    />,
  )
  expect(getSequenceFasta(getByTestId('sequence_panel')).split('\n')[1]).toBe(
    revCdna,
  )
})

const exon = { refName: 'chr1', start: 1000, end: 1400, type: 'exon' }
const innerCds = { refName: 'chr1', start: 1100, end: 1300, type: 'CDS' }

const renderLegend = (
  subfeatures: SimpleFeatureSerializedNoId[],
  { mode = 'cdna', ...seq }: { mode?: SequenceDisplayMode } & SeqState,
) => {
  const { getByTestId } = render(
    <SequencePanel
      model={SequenceFeatureDetailsF().create()}
      mode={mode}
      sequence={seq}
      feature={utrFeature(subfeatures)}
    />,
  )
  return getByTestId('sequence_panel').querySelector('[data-no-fasta]')
    ?.textContent
}

test.each([
  // only the swatches actually on screen are listed
  ['a coding transcript', [exon, innerCds], 'CDSUTR'],
  // one swatch explains nothing, so no legend at all
  ['a noncoding transcript', [exon], undefined],
  // the naive "has a CDS, so it has a UTR" would wrongly advertise a UTR here
  [
    'a transcript that is entirely CDS',
    [exon, { ...exon, type: 'CDS' }],
    undefined,
  ],
])('the legend describes %s', (_, subfeatures, expected) => {
  expect(renderLegend(subfeatures, { seq: utrSeq })).toBe(expected)
})

test('the legend picks up the flanks in an up/downstream mode', () => {
  expect(
    renderLegend([exon, innerCds], {
      mode: 'gene_updownstream',
      seq: utrSeq,
      upstream: 'C'.repeat(50),
      downstream: 'G'.repeat(50),
    }),
  ).toBe('CDSUTRup/downstream')
})

test('the rendered legend stays out of the copyable sequence', () => {
  const { getByTestId } = render(
    <SequencePanel
      model={SequenceFeatureDetailsF().create()}
      mode="cdna"
      sequence={{ seq: utrSeq }}
      feature={utrFeature([exon, innerCds])}
    />,
  )
  const panel = getByTestId('sequence_panel')
  // it is on screen, but must not reach the FASTA the user copies out
  expect(panel.querySelector('[data-no-fasta]')).toBeTruthy()
  expect(getSequenceFasta(panel)).toBe(
    `>utrs-cdna chr1:1,001-1,400(+)\n${utrSeq}`,
  )
})

test('a CDS annotated outside the exons renders the exon untranslated', () => {
  // no exon contains the CDS, so there is no coding stretch to color; the exon
  // sequence must still render rather than throwing
  expect(
    renderCdna([
      { refName: 'chr1', start: 1000, end: 1100, type: 'exon' },
      { refName: 'chr1', start: 1200, end: 1300, type: 'CDS' },
    ]),
  ).toBe('a'.repeat(100))
})

test('coordinate labels stay column-aligned when a row gains a digit', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      sequence={{ seq: 'A'.repeat(300) }}
      feature={{
        start: 9949,
        end: 10249,
        refName: 'chr1',
        strand: 1,
        type: 'region',
        uniqueId: 'straddle',
        name: 'straddle',
      }}
    />,
  )
  // the panel straddles 10,000, so the labels are not all the same length
  const rows = getByTestId('sequence_panel').textContent.split('\n').slice(1, 4)
  expect(rows.map(r => r.slice(0, 8))).toStrictEqual([
    ' 9950   ',
    '10050   ',
    '10150   ',
  ])
})

test('hovering publishes the assembly so the refName can be canonicalized', () => {
  const model = SequenceFeatureDetailsF().create()
  const hover = makeHoverTarget()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      hoverTarget={hover}
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      assemblyName="hg38"
      feature={{
        start: 1200,
        end: 1300,
        // a non-canonical refName: the LGV can only match this to the displayed
        // region by resolving it through the assembly's aliases
        refName: '1',
        strand: 1,
        type: 'region',
        uniqueId: 'alias',
        name: 'alias',
      }}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector(SEQ_SPAN)!
  const rectSpy = mockRowRect(span)
  fireEvent.mouseMove(span, { clientX: 0 })
  expect(hover.position).toEqual({
    refName: '1',
    start: 1200,
    end: 1201,
    assemblyName: 'hg38',
  })
  rectSpy.mockRestore()
})

test('coordinate spacing continues across exon/intron boundaries', () => {
  // exons of 20bp and 30bp around a 10bp intron: every segment boundary lands
  // on a column that is a multiple of the 10bp spacing interval
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene"
      sequence={{ seq: `${'A'.repeat(20)}${'c'.repeat(10)}${'G'.repeat(30)}` }}
      feature={{
        start: 1000,
        end: 1060,
        refName: 'chr1',
        strand: 1,
        type: 'mRNA',
        uniqueId: 'multi',
        name: 'multi',
        subfeatures: [
          { refName: 'chr1', start: 1000, end: 1020, type: 'exon' },
          { refName: 'chr1', start: 1030, end: 1060, type: 'exon' },
        ],
      }}
    />,
  )
  expect(renderedRow(getByTestId('sequence_panel'), 1)).toBe(
    '1001   AAAAAAAAAA AAAAAAAAAA cccccccccc GGGGGGGGGG GGGGGGGGGG GGGGGGGGGG',
  )
})

// Exons that stop short of the transcript's own bounds. Real annotations do
// this: CAT/liftoff spans a transcript over the source alignment and emits exons
// only where the CDS is supported, and 28 of the 438 transcripts in this repo's
// HPRC gene fixtures are short at one end or both. The untiled stretches used to
// be dropped, which shortened the readout AND slid every genomic label after
// them, since the labels count from the feature start regardless.
const shortExonFeature = {
  start: 1000,
  end: 1060,
  refName: 'chr1',
  strand: 1,
  type: 'mRNA',
  uniqueId: 'short',
  name: 'short',
  subfeatures: [
    { refName: 'chr1', start: 1010, end: 1020, type: 'exon' },
    { refName: 'chr1', start: 1030, end: 1050, type: 'exon' },
  ],
}
const shortExonSeq = `${'t'.repeat(10)}${'A'.repeat(10)}${'c'.repeat(10)}${'G'.repeat(20)}${'a'.repeat(10)}`

test('exons short of the feature bounds keep their genomic coordinates', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="gene"
      sequence={{ seq: shortExonSeq }}
      feature={shortExonFeature}
    />,
  )
  // the flanks read as the uncolored genomic stretches they are, the same way
  // the intron between the two exons does
  expect(renderedRow(getByTestId('sequence_panel'), 1)).toBe(
    '1001   tttttttttt AAAAAAAAAA cccccccccc GGGGGGGGGG GGGGGGGGGG aaaaaaaaaa',
  )
})

// The converse, and why the flanks cannot simply be folded into the first and
// last exon: they are not exonic, so the spliced readout must not carry them.
test('the spliced readout keeps the untiled flanks out', () => {
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="cdna"
      sequence={{ seq: shortExonSeq }}
      feature={shortExonFeature}
    />,
  )
  expect(
    getByTestId('sequence_panel')
      .textContent.split('\n')
      .slice(1)
      .map(s => s.trim())
      .join(''),
  ).toBe(`${'A'.repeat(10)}${'G'.repeat(20)}`)
})

test('single exon cDNA display relative coords', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  const { getByTestId } = render(
    <SequencePanel model={model} mode="gene" sequence={{ seq }} feature={f} />,
  )

  const element = getByTestId('sequence_panel')
  expect(getSequenceFasta(element)).toMatchSnapshot()
})

test('reverse complement flips a plus-strand genomic readout', () => {
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      revcomp
      sequence={{ seq: 'AAAACCCG' }}
      feature={{
        start: 0,
        end: 8,
        refName: 'chr1',
        strand: 1,
        type: 'region',
        uniqueId: 'plus',
        name: 'plus',
      }}
    />,
  )

  const text = getSequenceFasta(getByTestId('sequence_panel'))
  expect(text).toContain('CGGGTTTT')
  // the FASTA header records it, so a downloaded sequence says which strand it
  // came off
  expect(text.split('\n')[0]).toContain('revcomp')
})

test('reverse complement of a minus-strand feature is the plus strand', () => {
  // a minus-strand feature is already shown reverse-complemented, so the toggle
  // flips it back rather than reverse-complementing a second time
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      revcomp
      sequence={{ seq: 'AAAACCCG' }}
      feature={{
        start: 0,
        end: 8,
        refName: 'chr1',
        strand: -1,
        type: 'region',
        uniqueId: 'minus',
        name: 'minus',
      }}
    />,
  )

  expect(getSequenceFasta(getByTestId('sequence_panel'))).toContain('AAAACCCG')
})

test('reverse complement counts genomic coordinates down', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="genomic"
      revcomp
      sequence={{ seq: 'ACGT'.repeat(75) }}
      feature={{
        start: 0,
        end: 300,
        refName: 'chr1',
        strand: 1,
        type: 'region',
        uniqueId: 'plus',
        name: 'plus',
      }}
    />,
  )

  const rowStarts = renderedRowStarts(getByTestId('sequence_panel'))

  expect(rowStarts).toEqual([300, 200, 100])
})

test('reverse complement is ignored by spliced sequence types', () => {
  // the toggle is only offered for the genomic types; a stale one must not flip
  // a cDNA readout
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      mode="cdna"
      revcomp
      sequence={{ seq: 'AAAACCCG' }}
      feature={{
        start: 0,
        end: 8,
        refName: 'chr1',
        strand: 1,
        type: 'mRNA',
        uniqueId: 'tx',
        name: 'tx',
        subfeatures: [{ refName: 'chr1', start: 0, end: 8, type: 'exon' }],
      }}
    />,
  )

  const text = getSequenceFasta(getByTestId('sequence_panel'))
  expect(text).toContain('AAAACCCG')
  expect(text.split('\n')[0]).not.toContain('revcomp')
})
