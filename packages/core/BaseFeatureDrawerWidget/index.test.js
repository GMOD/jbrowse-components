import { render } from '@testing-library/react'
import React from 'react'
import { stateModel } from '.'
import ReactComponent from './BaseFeatureDetail'

test('open up a drawer widget', async () => {
  const model = stateModel.create({ type: 'BaseFeatureDrawerWidget' })
  const { container, getByText } = render(<ReactComponent model={model} />)
  model.setFeatureData({
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    refName: 'ctgA',
  })
  expect(container.firstChild).toMatchSnapshot()
  expect(getByText('ctgA:3..102')).toBeTruthy()
})
