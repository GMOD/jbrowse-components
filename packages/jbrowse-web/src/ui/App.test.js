import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import JBrowse from '../JBrowse'
import RootModelFactory from '../RootModelFactory'
import snap1 from '../../test/root.snap.1.json'

describe('jbrowse-web app', () => {
  it('renders an empty model without crashing', () => {
    const jbrowse = new JBrowse().configure()
    const div = document.createElement('div')
    const model = RootModelFactory(jbrowse).create()
    ReactDOM.render(
      <App getViewType={jbrowse.getViewType} rootModel={model} />,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  })
  it('renders a couple of LinearGenomeView views without crashing', () => {
    const jbrowse = new JBrowse().configure()
    const div = document.createElement('div')
    const model = RootModelFactory(jbrowse).create(snap1)
    ReactDOM.render(
      <App getViewType={jbrowse.getViewType} rootModel={model} />,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  })
})
