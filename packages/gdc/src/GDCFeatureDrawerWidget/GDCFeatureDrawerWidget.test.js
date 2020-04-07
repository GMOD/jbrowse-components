import React from 'react'
import { render } from '@testing-library/react'
import { observable } from 'mobx'

import GDCFeatureDetails from './GDCFeatureDrawerWidget'

describe('GDCTrack drawer widget', () => {
  it('renders with just the required model elements', () => {
    const f = observable({
      featureData: {
        uniqueId: 'fb492b61-9214-52b7-8c9c-0393fe3ef4ca',
        refName: 'chr3',
        type: 'Simple Somatic Mutation',
        start: 328338,
        end: 328339,
        chromosome: 'chr3',
        cosmicId:
          "<a href='https://cancer.sanger.ac.uk/cosmic/mutation/overview?id=1043952' target='_blank'>1043952</a>",
        endPosition: 328339,
        genomicDnaChange: 'chr3:g.328339G>T',
        mutationSubtype: 'Single base substitution',
        mutationType: 'Simple Somatic Mutation',
        ncbiBuild: 'GRCh38',
        referenceAllele: 'G',
        score: 8,
        ssmId:
          "<a href='https://portal.gdc.cancer.gov/ssms/fb492b61-9214-52b7-8c9c-0393fe3ef4ca' target='_blank'>fb492b61-9214-52b7-8c9c-0393fe3ef4ca</a>",
        startPosition: 328339,
      },
    })

    const { container } = render(<GDCFeatureDetails model={f} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
