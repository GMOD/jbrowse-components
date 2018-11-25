import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'
import App from './App'
import JBrowse from '../JBrowse'
import RootModelFactory from '../RootModelFactory'
import snap1 from '../../test_data/root.snap.1.json'

describe('jbrowse-web app', () => {
  it('renders an empty model without crashing', () => {
    const jbrowse = new JBrowse().configure()
    const div = document.createElement('div')
    const model = RootModelFactory(jbrowse).create()
    ReactDOM.render(
      <Provider rootModel={model}>
        <App
          getViewType={jbrowse.getViewType}
          getDrawerWidgetType={jbrowse.getDrawerWidgetType}
        />
      </Provider>,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  })
  it('renders a couple of LinearGenomeView views without crashing', () => {
    const jbrowse = new JBrowse().configure()
    const div = document.createElement('div')
    const model = RootModelFactory(jbrowse).create(snap1)
    ReactDOM.render(
      <Provider rootModel={model}>
        <App
          getViewType={jbrowse.getViewType}
          getDrawerWidgetType={jbrowse.getDrawerWidgetType}
        />
      </Provider>,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  })
})
