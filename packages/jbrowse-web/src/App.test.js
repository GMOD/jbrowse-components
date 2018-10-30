import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import RootModel from './model'
import snap1 from '../test/root.snap.1.json'

describe('jbrowse-web app', () => {
  it('renders an empty model without crashing', () => {
    const div = document.createElement('div')
    const model = RootModel.create({})
    ReactDOM.render(<App rootModel={model} />, div)
    ReactDOM.unmountComponentAtNode(div)
  })
  it('renders a couple of linear views without crashing', () => {
    const div = document.createElement('div')
    const model = RootModel.create(snap1)
    ReactDOM.render(<App rootModel={model} />, div)
    ReactDOM.unmountComponentAtNode(div)
  })
})
