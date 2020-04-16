import React from 'react'
import { render } from '@testing-library/react'
import { observable } from 'mobx'

import GDCFeatureDetails from './GDCFeatureDrawerWidget'

describe('GDCTrack drawer widget', () => {
  it('renders mutation with just the required model elements', () => {
    /* eslint-disable @typescript-eslint/camelcase */
    const f = observable({
      featureData: {
        uniqueId: '0208efeb-f1e8-57e4-8447-299c5f050380',
        refName: 'chr3',
        type: 'Simple Somatic Mutation',
        start: 377917,
        end: 377918,
        chromosome: 'chr3',
        consequence: {
          hits: {
            edges: [
              {
                node: {
                  id:
                    'U1NNQ29uc2VxdWVuY2U6MDIwOGVmZWItZjFlOC01N2U0LTg0NDctMjk5YzVmMDUwMzgwOjZkYmQ5M2M2LWYwZWYtNTdhZS1iZmQxLWYxM2RlNmM5ZWI0Ng==',
                  transcript: {
                    aa_change: 'D618N',
                    annotation: {
                      hgvsc: 'c.1852G>A',
                      polyphen_impact: 'benign',
                      polyphen_score: 0.008,
                      sift_impact: 'tolerated',
                      sift_score: 0.08,
                      vep_impact: 'MODERATE',
                    },
                    consequence_type: 'missense_variant',
                    gene: {
                      gene_id: 'ENSG00000134121',
                      gene_strand: 1,
                      symbol: 'CHL1',
                    },
                    is_canonical: false,
                    transcript_id: 'ENST00000620033',
                  },
                },
              },
            ],
          },
        },
        cosmicId: ['COSM1044638'],
        endPosition: 377918,
        genomicDnaChange: 'chr3:g.377918G>A',
        mutationSubtype: 'Single base substitution',
        mutationType: 'Simple Somatic Mutation',
        ncbiBuild: 'GRCh38',
        referenceAllele: 'G',
        score: 3,
        ssmId: '0208efeb-f1e8-57e4-8447-299c5f050380',
        startPosition: 377918,
      },
    })
    /* eslint-enable @typescript-eslint/camelcase */

    const { container } = render(<GDCFeatureDetails model={f} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders gene with just the required model elements', () => {
    const f = observable({
      featureData: {
        uniqueId: 'ENSG00000134121',
        refName: '3',
        type: 'protein_coding',
        start: 196595,
        end: 409417,
        biotype: 'protein_coding',
        canonicalTranscriptId: 'ENST00000256509',
        description:
          'The protein encoded by this gene is a member of the L1 gene family of neural cell adhesion molecules. It is a neural recognition molecule that may be involved in signal transduction pathways. The deletion of one copy of this gene may be responsible for mental defects in patients with 3p- syndrome. This protein may also play a role in the growth of certain cancers. Alternate splicing results in both coding and non-coding variants. [provided by RefSeq, Nov 2011]',
        externalDbIds: {
          entrezGene: ['10752'],
          hgnc: ['HGNC:1939'],
          omimGene: ['607416'],
          uniprotkbSwissprot: ['O00533'],
        },
        geneChromosome: '3',
        geneEnd: 409417,
        geneId: 'ENSG00000134121',
        geneStart: 196596,
        geneStrand: 1,
        id:
          'R2VuZTpFTlNHMDAwMDAxMzQxMjEjZTQ2MDk1NGM4MmZiMjczYjIwNTk1MDliODFkZTZmYjEj',
        isCancerGeneCensus: null,
        name: 'cell adhesion molecule L1-like',
        symbol: 'CHL1',
        synonyms: ['CALL', 'FLJ44930', 'L1CAM2', 'MGC132578'],
      },
    })

    const { container } = render(<GDCFeatureDetails model={f} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
