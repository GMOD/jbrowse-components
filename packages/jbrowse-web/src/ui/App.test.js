import { Provider } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React from 'react'
import ReactDOM from 'react-dom'
import snap1 from '../../test/root.snap.1.json'
import JBrowse from '../JBrowse'
import RootModelFactory from '../RootModelFactory'
import App from './App'

describe('jbrowse-web app', () => {
  it('renders an empty model without crashing', () => {
    const jbrowse = new JBrowse().configure()
    const div = document.createElement('div')
    const model = RootModelFactory(jbrowse).create()
    expect(getSnapshot(model)).toMatchSnapshot()
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
    expect(getSnapshot(model)).toMatchSnapshot()
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
