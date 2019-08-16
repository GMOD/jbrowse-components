import { render, waitForElement } from '@testing-library/react'
import React from 'react'
import { ProteinWidget, ProteinViewer } from './Viewer'
import data from '../mydata'

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}

test('basic protein widget rendering', async () => {
  const widget = new ProteinWidget(data)
  const { getAllByTestId } = render(<ProteinViewer widget={widget} />)
  const feature = await waitForElement(() => getAllByTestId('IPR005225_1_159'))
  expect(feature[0]).toMatchSnapshot()
})
