import { render, waitForElement } from '@testing-library/react'
import React from 'react'
import { ProteinWidget, ProteinViewer } from './Viewer'
import data from '../mydata'

test('basic protein widget rendering', async () => {
  const widget = new ProteinWidget(window.data)
  console.log(ProteinViewer, widget)
  const { container } = render(<ProteinViewer model={widget.model} />)
  expect(container).toMatchSnapshot()
})
