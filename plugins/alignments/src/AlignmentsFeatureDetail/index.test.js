import { render } from '@testing-library/react'
import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { stateModelFactory } from '.'
import ReactComponent from './AlignmentsFeatureDetail'

test('open up a widget', () => {
  console.warn = jest.fn()
  const pluginManager = new PluginManager([])
  const model = stateModelFactory(pluginManager).create({
    type: 'AlignmentsFeatureWidget',
  })
  model.setFeatureData({
    seq:
      'TTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAG',
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
  const { container, getByText } = render(<ReactComponent model={model} />)
  expect(container.firstChild).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
