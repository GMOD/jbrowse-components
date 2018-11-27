import { Provider } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React from 'react'
import ReactDOM from 'react-dom'
import snap1 from '../../test/root.snap.1.json'
import JBrowse from '../JBrowse'
import RootModelFactory from '../RootModelFactory'
import App from './App'

describe('jbrowse-web app', () => {
  const jbrowse = new JBrowse().configure()
  const div = document.createElement('div')

  function render(model) {
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
  }

  it('renders an empty model without crashing', () => {
    const model = RootModelFactory(jbrowse).create()
    expect(getSnapshot(model)).toMatchSnapshot()
    render(model)
  })

  it('renders a couple of LinearGenomeView views without crashing', () => {
    const model = RootModelFactory(jbrowse).create(snap1)
    expect(getSnapshot(model)).toMatchSnapshot()
    render(model)
  })

  it('accepts a custom drawer width', () => {
    const model = RootModelFactory(jbrowse).create({
      drawerWidth: 256,
    })
    expect(model.drawerWidth).toBe(256)
    expect(model.viewsWidth).toBe(761)
    render(model)
  })

  it('expands a drawer width that is too small', () => {
    const model = RootModelFactory(jbrowse).create({
      drawerWidth: 50,
    })
    expect(model.drawerWidth).toBe(100)
    render(model)
  })

  it('shrinks a drawer width that is too big', () => {
    const model = RootModelFactory(jbrowse).create({
      drawerWidth: 4096,
    })
    expect(model.drawerWidth).toBe(867)
    render(model)
  })
})
