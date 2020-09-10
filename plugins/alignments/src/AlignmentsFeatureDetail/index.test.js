import { render } from '@testing-library/react'
import React from 'react'
import { stateModel } from '.'
import ReactComponent from './AlignmentsFeatureDetail'

test('open up a widget', () => {
  const model = stateModel.create({ type: 'AlignmentsFeatureWidget' })
  const { container, getByText } = render(<ReactComponent model={model} />)
  model.setFeatureData({
    seq:
      'TTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAG',
    unmapped: false,
    qc_failed: false,
    duplicate: false,
    secondary_alignment: false,
    supplementary_alignment: false,
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    qual:
      '17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17',
    MQ: 37,
    CIGAR: '100M',
    length_on_ref: 100,
    template_length: 0,
    seq_length: 100,
    name: 'ctgA_3_555_0:0:0_2:0:0_102d',
    refName: 'ctgA',
    type: 'match',
  })
  expect(container.firstChild).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
