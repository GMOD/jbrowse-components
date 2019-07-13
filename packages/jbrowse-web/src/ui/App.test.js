import { getSnapshot } from 'mobx-state-tree'
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { createTestSession } from '../jbrowseModel'

describe('jbrowse-web app', () => {
  const div = document.createElement('div')

  function render(model, pluginManager) {
    ReactDOM.render(
      <App
        session={model}
        getViewType={pluginManager.getViewType}
        getDrawerWidgetType={pluginManager.getDrawerWidgetType}
        getMenuBarType={pluginManager.getMenuBarType}
      />,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  }

  it('renders an empty model without crashing', () => {
    const session = createTestSession({
      defaultSession: {},
    })
    const { pluginManager } = session
    expect(getSnapshot(session)).toMatchSnapshot({
      configuration: {
        configId: expect.any(String),
        rpc: { configId: expect.any(String) },
      },
      menuBars: [{ id: expect.any(String) }],
      name: expect.any(String),
    })
    render(session, pluginManager)
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ defaultSession: { drawerWidth: 256 } })
    const { pluginManager } = session
    expect(session.drawerWidth).toBe(256)
    expect(session.viewsWidth).toBe(512)
    render(session, pluginManager)
  })

  it('records error if drawer width is too small', () => {
    const root = createTestSession(
      { defaultSession: { drawerWidth: 50 } },
      true,
    )
    expect(root.errorMessage).toBeTruthy()
  })

  it('shrinks a drawer width that is too big', () => {
    const session = createTestSession({
      defaultSession: { width: 1024, drawerWidth: 256 },
    })
    const { pluginManager } = session
    session.updateWidth(512)
    expect(session.drawerWidth).toBe(256)
    render(session, pluginManager)
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
