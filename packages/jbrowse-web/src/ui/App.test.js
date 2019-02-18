import { Provider } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React from 'react'
import ReactDOM from 'react-dom'
import PluginManager from '../PluginManager'
import RootModelFactory from '../rootModel'
import App from './App'

describe('jbrowse-web app', () => {
  const pluginManager = new PluginManager()
  const div = document.createElement('div')

  function render(model, mgr = pluginManager) {
    ReactDOM.render(
      <Provider rootModel={model}>
        <App
          getViewType={mgr.getViewType}
          getDrawerWidgetType={mgr.getDrawerWidgetType}
          getMenuBarType={mgr.getMenuBarType}
        />
      </Provider>,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  }

  it('renders an empty model without crashing', () => {
    const model = RootModelFactory({ pluginManager }).create()
    expect(getSnapshot(model)).toMatchSnapshot({
      configuration: {
        configId: expect.any(String),
        rpc: { configId: expect.any(String) },
      },
    })
    render(model)
  })

  it('accepts a custom drawer width', () => {
    const model = RootModelFactory({ pluginManager }).create({
      drawerWidth: 256,
    })
    expect(model.drawerWidth).toBe(256)
    expect(model.viewsWidth).toBe(512)
    render(model)
  })

  it('throws if drawer width is too small', () => {
    expect(() =>
      RootModelFactory({ pluginManager }).create({
        drawerWidth: 50,
      }),
    ).toThrow()
  })

  it('shrinks a drawer width that is too big', () => {
    const model = RootModelFactory({ pluginManager }).create({
      width: 1024,
      drawerWidth: 4096,
    })
    model.updateWidth(512)
    expect(model.drawerWidth).toBe(256)
    render(model)
  })

  // describe('restoring and rendering from snapshots', () => {
  //   ;['root.snap.1.json'].forEach(snapName => {
  //     it(`renders ${snapName} without crashing`, async () => {
  //       const jbrowse = new JBrowse().configure()
  //       const snap = JSON.parse(
  //         await fs.readFile(require.resolve(`../../test_data/${snapName}`)),
  //       )
  //       const model = jbrowse.modelType.create(snap)
  //       render(model, jbrowse.pluginManager)
  //     })
  //   })
  // })
})
