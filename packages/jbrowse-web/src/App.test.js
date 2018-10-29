import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import RootModel from './model'

describe('jbrowse-web app', () => {
  it('renders an empty model without crashing', () => {
    const div = document.createElement('div')
    const model = RootModel.create({})
    ReactDOM.render(<App rootModel={model} />, div)
    ReactDOM.unmountComponentAtNode(div)
  })
  it('renders a couple of linear views without crashing', () => {
    const div = document.createElement('div')
    const model = RootModel.create({
      views: [
        {
          type: 'linear',
          id: 1,
          offsetPx: 0,
          bpPerPx: 1,
          blocks: [{ refName: 'ctgA', start: 0, end: 100 }],
          tracks: [
            { id: 'foo', name: 'Foo Track', type: 'tester', height: 20 },
            { id: 'bar', name: 'Bar Track', type: 'tester', height: 20 },
            { id: 'baz', name: 'Baz Track', type: 'tester', height: 20 },
          ],
          controlsWidth: 100,
          width: 800,
        },
        {
          type: 'linear',
          id: 2,
          offsetPx: 0,
          bpPerPx: 1,
          blocks: [{ refName: 'ctgA', start: 0, end: 100 }],
          tracks: [
            { id: 'bee', name: 'Bee Track', type: 'tester', height: 20 },
            { id: 'bonk', name: 'Bonk Track', type: 'tester', height: 20 },
          ],
          controlsWidth: 100,
          width: 800,
        },
      ],
    })
    ReactDOM.render(<App rootModel={model} />, div)
    ReactDOM.unmountComponentAtNode(div)
  })
})
