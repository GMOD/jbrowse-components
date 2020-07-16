import { render } from '@testing-library/react'
import React from 'react'
import { stateModel } from '.'
import { BaseFeatureDetails as ReactComponent } from './BaseFeatureDetail'

test('open up a drawer widget', () => {
  const model = stateModel.create({ type: 'BaseFeatureWidget' })
  const { container, getByText } = render(<ReactComponent model={model} />)
  model.setFeatureData({
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    refName: 'ctgA',
  })
  expect(container.firstChild).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
