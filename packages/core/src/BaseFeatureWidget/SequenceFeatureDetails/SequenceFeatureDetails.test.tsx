import fs from 'node:fs'

import { fireEvent, render } from '@testing-library/react'

import SequencePanel from './SequencePanel.tsx'
import { SequenceFeatureDetailsF } from './model.ts'
import DLGAP3 from './test_data/DLGAP3.ts'
import NCDN from './test_data/NCDN.ts'
import { getSequencePlaintext } from './util.ts'

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
  expect(element.textContent).toMatchSnapshot()
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
  expect(element.textContent).toMatchSnapshot()
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

test('plaintext copy strips legend so it does not corrupt FASTA output', () => {
  const el = document.createElement('div')
  el.innerHTML =
    '<div data-no-plaintext>legend note: selenocysteine</div>' +
    '<pre>&gt;made_up\nACGTACGT</pre>'
  expect(getSequencePlaintext(el)).toEqual('>made_up\nACGTACGT')
})

test('single exon cDNA should not have duplicate sequences', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  const { getByTestId } = render(
    <SequencePanel model={model} mode="cdna" sequence={{ seq }} feature={f} />,
  )

  const element = getByTestId('sequence_panel')

  expect(
    element.textContent
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
  expect(element.textContent).toMatchSnapshot()
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

  const rowStarts = getByTestId('sequence_panel')
    .textContent.split('\n')
    .slice(1)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => +s.split(/\s+/, 1)[0]!)

  // reverse strand genomic coordinates must decrement, not increment
  expect(rowStarts).toEqual([300, 200, 100])
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

  const rowStarts = getByTestId('sequence_panel')
    .textContent.split('\n')
    .slice(1)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => +s.split(/\s+/, 1)[0]!)

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

  const rowStarts = getByTestId('sequence_panel')
    .textContent.split('\n')
    .slice(1)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => +s.split(/\s+/, 1)[0]!)

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

  const rowStarts = getByTestId('sequence_panel')
    .textContent.split('\n')
    .slice(1)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => +s.split(/\s+/, 1)[0]!)

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
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      feature={feature}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector('span')!
  const rectSpy = mockRowRect(span)

  // cursor at the row start => first feature base (0-based 1200)
  fireEvent.mouseMove(span, { clientX: 0 })
  expect(model.hoverPosition).toEqual({
    refName: 'chr1',
    start: 1200,
    end: 1201,
  })

  // 5.5 columns in => 6th base (0-based 1205)
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(model.hoverPosition).toEqual({
    refName: 'chr1',
    start: 1205,
    end: 1206,
  })

  fireEvent.mouseLeave(getByTestId('sequence_panel'))
  expect(model.hoverPosition).toBeUndefined()
  rectSpy.mockRestore()
})

test('hovering a reverse-strand genomic sequence counts positions down', () => {
  const model = SequenceFeatureDetailsF().create()
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
      mode="genomic"
      sequence={{ seq: 'A'.repeat(100) }}
      feature={feature}
    />,
  )
  const span = getByTestId('sequence_panel').querySelector('span')!
  const rectSpy = mockRowRect(span)

  // display char 0 is the last genomic base (0-based 99)
  fireEvent.mouseMove(span, { clientX: 0 })
  expect(model.hoverPosition).toEqual({ refName: 'chr1', start: 99, end: 100 })

  // 5 columns in counts down to base 94
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(model.hoverPosition).toEqual({ refName: 'chr1', start: 94, end: 95 })
  rectSpy.mockRestore()
})

test('hovering does not report positions when coordinates are not genomic', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
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
  const span = getByTestId('sequence_panel').querySelector('span')!
  const rectSpy = mockRowRect(span)
  fireEvent.mouseMove(span, { clientX: 55 })
  expect(model.hoverPosition).toBeUndefined()
  rectSpy.mockRestore()
})

test('single exon cDNA display relative coords', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  const { getByTestId } = render(
    <SequencePanel model={model} mode="gene" sequence={{ seq }} feature={f} />,
  )

  const element = getByTestId('sequence_panel')
  expect(element.textContent).toMatchSnapshot()
})
