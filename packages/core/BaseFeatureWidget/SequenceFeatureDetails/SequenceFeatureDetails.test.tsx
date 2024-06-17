import React from 'react'
import { render } from '@testing-library/react'
import fs from 'fs'

// locals
import SequencePanel from './SequencePanel'
import { SequenceFeatureDetailsF } from './model'

// test data
import DLGAP3 from './test_data/DLGAP3'
import NCDN from './test_data/NCDN'

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
  model.setMode('protein')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')

  // http://m.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000116544;r=1:34865436-34929650
  // with stop codon on the end
  expect(
    element.textContent
      ?.split('\n')
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
  model.setMode('protein')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')
  // make sure show coords shows the expected sequence as well
  expect(
    element.textContent
      ?.split('\n')
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
  model.setMode('gene_collapsed_intron')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      sequence={{ seq: dna }}
      feature={feature.subfeatures[0]}
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
  model.setMode('gene_updownstream')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      sequence={{ seq, upstream }}
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')

  expect(element.textContent).toMatchSnapshot()

  // expect(element.children[1].textContent).toEqual(
  //   'AGTGGGCAACGCGGCGTGAGCAGCGGCCCGAGGCTCCCGGAGCATCGCGCTGGGAGAAGACTTCGCCGCTCGGGGCCGCAGCCTGGTGAGCTCAGCCCCCTTCGGGCCCTCCCCTGCATCCCAGCCGGGGCCTCTCCGAGCCGGCGCTGATCGATGCCGACACACCCCGGGGACCCTATCGCGACTCCATCGCGCCATATCGCGACACCATCGTGCCCTGTCGAGACTCCATTTTGTCACAGCCCTTTTCAATATATATCTTTTTTTTTTTTAATTTGCCCTGTCATCTTTGGGGGCTGTCTCCCATGTCGTGATTTTGACGTGATCTCTCCGTGACATCACCGCGCCATCGTGAAGTGTGATCTCATCGCCGCCCTGTCGTGACTTCATCA',
  // )

  // 3rd is a blank element, so go to 4th, not strictly needed for 3rd to be
  // blank but helps test
  // expect(element.children[3].textContent).toEqual(
  //   'ATGTCGTGTTGTGACCTGGCTGCGGCGGGACAG',
  // )
})

test('single exon cDNA should not have duplicate sequences', () => {
  const seq = readFasta('./test_data/volvox.fa')
  const model = SequenceFeatureDetailsF().create()
  model.setMode('cdna')
  const { getByTestId } = render(
    <SequencePanel
      model={model}
      sequence={{ seq }}
      feature={{
        start: 1200,
        end: 1500,
        refName: 'chr1',
        type: 'mRNA',
        uniqueId: 'unique',
        subfeatures: [
          { refName: 'chr1', start: 1200, end: 1500, type: 'exon' },
          { refName: 'chr1', start: 1200, end: 1500, type: 'CDS' },
        ],
      }}
    />,
  )

  const element = getByTestId('sequence_panel')

  expect(
    element.textContent
      ?.split('\n')
      .slice(1)
      .map(s => s.trim())
      .join(''),
  ).toEqual(
    'ATGTCACCTCGGGTACTGCCTCTATTACAGAGGTATCTTAATGGCGCATCCAGCCTTGTGGCTGGGTCTACGTACGCGTGGGCACCATACGTATGTTGGCAGGAAAGGTCAATCATGCTTGTTTCCTCGTCGCAGAAACGTTCACACTATTGGCTCGCGGGATCGAACGGGCCTGATTATTTTTCCAGCTCCTGCGTTCCTATCACGCCAACTGTCGCTAATAAAATGTTATATAGAGATAACCCATTGCTATGCAAGGATGGAGAAACCGCTTCACAACACCCTAGAATTACTTCAGCA',
  )
})
