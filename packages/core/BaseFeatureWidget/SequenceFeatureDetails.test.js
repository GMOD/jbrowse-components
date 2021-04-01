import React from 'react'
import { render } from '@testing-library/react'
import fs from 'fs'
import { SequencePanel } from './SequenceFeatureDetails'
import DLGAP3 from './test_data/DLGAP3.json'
import NCDN from './test_data/NCDN.json'

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
  const { getByTestId } = render(
    <SequencePanel
      sequence={{ seq: dna }}
      mode="protein"
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')

  // http://m.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000116544;r=1:34865436-34929650
  // with stop codon on the end
  expect(element.textContent).toEqual(`${pep}*`)
})

const readFasta = filename => {
  return fs
    .readFileSync(require.resolve(filename), 'utf8')
    .split('\n')
    .slice(1)
    .join('')
}

test('NCDN collapsed intron', () => {
  // samtools faidx 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz' 1:36,023,400-36,032,380 > out.fa
  const dna = readFasta('./test_data/NCDN_dna.fa')

  // http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-zMPjiv36k0&password=ddxCy
  const feature = NCDN
  const { getByTestId } = render(
    <SequencePanel
      sequence={{ seq: dna }}
      mode="gene_collapsed_intron"
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')

  // UTR
  expect(element.children[0].textContent).toEqual(
    'AGTGGGCAACGCGGCGTGAGCAGCGGCCCGAGGCTCCCGGAGCATCGCGCTGGGAGAAGACTTCGCCGCTCGGGGCCGCAGCCTGGTGAGCTCAGCCCCCTTCGGGCCCTCCCCTGCATCCCAGCCGGGGCCTCTCCGAGCCGGCGCTGATCGATGCCGACACACCCCGGGGACCCTATCGCGACTCCATCGCGCCATATCGCGACACCATCGTGCCCTGTCGAGACTCCATTTTGTCACAGCCCTTTTCAATATATATCTTTTTTTTTTTTAATTTGCCCTGTCATCTTTGGGGGCTGTCTCCCATGTCGTGATTTTGACGTGATCTCTCCGTGACATCACCGCGCCATCGTGAAGTGTGATCTCATCGCCGCCCTGTCGTGACTTCATCA',
  )
  // first CDS
  expect(element.children[2].textContent).toEqual(
    'ATGTCGTGTTGTGACCTGGCTGCGGCGGGACAG',
  )
  // spliced intron
  expect(element.children[3].textContent).toEqual('GTGGTGACCG...GTGTTCACAG')
})

test('NCDN updownstream', () => {
  // produced from uniprot
  // https://www.uniprot.org/uniprot/O95886.fasta
  const upstream = readFasta('./test_data/NCDN_upstream_dna.fa')

  // samtools faidx 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz' 1:36,023,400-36,032,380 > out.fa
  const seq = readFasta('./test_data/NCDN_dna.fa')

  // http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-zMPjiv36k0&password=ddxCy
  const feature = NCDN
  const { getByTestId } = render(
    <SequencePanel
      sequence={{ seq, upstream }}
      mode="gene_updownstream"
      feature={feature.subfeatures[0]}
    />,
  )

  const element = getByTestId('sequence_panel')

  expect(element.children[0].textContent).toEqual(
    'CTCACCCGGAGGAGGAGGAGGAAGAGGAAGAAGGTAGTGCGGGCTCCCCACCCGGACAGCTACCTCTCGCCTCAGCCTCCCTGGACAGCGACGGCGGCCGGAAACACCGCCTCCTCCCACCTCCCCGGGACCGACCCGGAAACACACTCTCCATGCTAACCAAGCCCTCCCGCCCCTCCCCCGGGAAGGGCAATGCCGGCCGCGAGACCAAGGGGGAGGAGGGGCAGTGCTGGGCGGGTAAAACTACGCACAAGCGAAGGAATCTGGGCCCCCAGCCTCTCGCCGCCCGCTCTCCAGAGGCAGTCTGCACCTTGCCTCCTTCGCTCGAGCCCCAGCCCCCAGACTCGGGCAATACCCACAAGCAAGATGGCGGCAACGGCGGCACCCCCTACTGCTTAGCACCCTGACTTGCCATTGGCCAGAGCCCGGAGTGAAGCAGCCGCGGATTCGTCAAGAGCGGTGCGGGGGTGGGGGTGGAGCTGCAGCAGCCTGGAGCCAGG',
  )
  expect(element.children[1].textContent).toEqual(
    'AGTGGGCAACGCGGCGTGAGCAGCGGCCCGAGGCTCCCGGAGCATCGCGCTGGGAGAAGACTTCGCCGCTCGGGGCCGCAGCCTGGTGAGCTCAGCCCCCTTCGGGCCCTCCCCTGCATCCCAGCCGGGGCCTCTCCGAGCCGGCGCTGATCGATGCCGACACACCCCGGGGACCCTATCGCGACTCCATCGCGCCATATCGCGACACCATCGTGCCCTGTCGAGACTCCATTTTGTCACAGCCCTTTTCAATATATATCTTTTTTTTTTTTAATTTGCCCTGTCATCTTTGGGGGCTGTCTCCCATGTCGTGATTTTGACGTGATCTCTCCGTGACATCACCGCGCCATCGTGAAGTGTGATCTCATCGCCGCCCTGTCGTGACTTCATCA',
  )

  // 3rd is a blank element, so go to 4th, not strictly needed for 3rd to be
  // blank but helps test
  expect(element.children[3].textContent).toEqual(
    'ATGTCGTGTTGTGACCTGGCTGCGGCGGGACAG',
  )
})
