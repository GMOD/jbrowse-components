import React from 'react'
import { render } from 'react-testing-library'
import { observable } from 'mobx'

import VariantFeatureDetails from './VariantFeatureDrawerWidget'

describe('VariantTrack drawer widget', () => {
  it('renders with just the required model elements', () => {
    const f = observable({
      featureData: {
        refName: 'ctgA',
        POS: '176',
        REF: 'A',
        ALT: 'C',
        QUAL: 10.4,
        INFO: {
          MQ: 5,
        },
      },
    })

    const { container } = render(<VariantFeatureDetails model={f} />)
    expect(container).toMatchSnapshot()
  })
})
