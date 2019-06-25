import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import { getSnapshot, types } from 'mobx-state-tree'
import { render, waitForElement } from 'react-testing-library'
import React from 'react'
import { stateModel, configSchema } from './index'
import ReactComponent from './AlignmentsFeatureDetail'

test('open up a drawer widget', async () => {
  const rootModel = stateModel.create({ type: 'AlignmentsFeatureDrawerWidget' })
  const { container, getByTestId } = render(
    <ReactComponent model={rootModel} />,
  )
  expect(container).toMatchSnapshot()
  rootModel.setFeatureData({
    id: '1234',
    name: 'hi',
  })
  expect(container).toMatchSnapshot()
})
