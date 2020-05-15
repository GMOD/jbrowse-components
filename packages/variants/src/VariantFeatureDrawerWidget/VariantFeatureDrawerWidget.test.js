import React from 'react'
import { render } from '@testing-library/react'
import { observable } from 'mobx'

import VariantFeatureDetails from './VariantFeatureDrawerWidget'

describe('VariantTrack drawer widget', () => {
  it('renders with just the required model elements', () => {
    const f = observable({
      featureData: {
        refName: 'ctgA',
        start: 176,
        end: 177,
        name: 'rs123',
        REF: 'A',
        ALT: '<TRA>',
        QUAL: 10.4,
        INFO: {
          MQ: 5,
        },
      },
    })

    const { container } = render(<VariantFeatureDetails model={f} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
