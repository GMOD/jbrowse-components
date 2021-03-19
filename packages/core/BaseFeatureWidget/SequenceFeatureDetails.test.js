import React from 'react'
import { render } from '@testing-library/react'
import fs from 'fs'
import { SequencePanel } from './SequenceFeatureDetails'
import DLGAP3 from './test_data/DLGAP3.json'

test('test using the sequence feature panel', () => {
  const sequence = 'abc'
  // produced from uniprot https://www.uniprot.org/uniprot/O95886.fasta
  const peptide = fs
    .readFileSync(require.resolve('./test_data/DLGAP3_pep.txt'), 'utf8')
    .split('\n')
    .slice(1)
    .join('')

  // produced with samtools faidx 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz' 1:35331037..35395251
  const dna = fs
    .readFileSync(require.resolve('./test_data/DLGAP3_dna.fa'), 'utf8')
    .split('\n')
    .slice(1)
    .join('')

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
  expect(1).toEqual(1)

  // http://m.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000116544;r=1:34865436-34929650
  // with stop codon on the end
  expect(element.textContent).toEqual(`${peptide}*`)
})
