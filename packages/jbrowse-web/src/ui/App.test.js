import { getSnapshot } from 'mobx-state-tree'
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { createTestEnv } from '../JBrowse'

describe('jbrowse-web app', () => {
  const div = document.createElement('div')

  function render(model, pluginManager) {
    ReactDOM.render(
      <App
        rootModel={model}
        getViewType={pluginManager.getViewType}
        getDrawerWidgetType={pluginManager.getDrawerWidgetType}
        getMenuBarType={pluginManager.getMenuBarType}
      />,
      div,
    )
    ReactDOM.unmountComponentAtNode(div)
  }

  it('renders an empty model without crashing', async () => {
    const { rootModel, pluginManager } = await createTestEnv({
      defaultSession: {},
    })
    expect(getSnapshot(rootModel)).toMatchSnapshot({
      configuration: {
        configId: expect.any(String),
        rpc: { configId: expect.any(String) },
      },
    })
    render(rootModel, pluginManager)
  })

  it('accepts a custom drawer width', async () => {
    const { rootModel, pluginManager } = await createTestEnv({
      defaultSession: { drawerWidth: 256 },
    })
    expect(rootModel.drawerWidth).toBe(256)
    expect(rootModel.viewsWidth).toBe(512)
    render(rootModel, pluginManager)
  })

  it('throws if drawer width is too small', async () => {
    await expect(
      createTestEnv({
        defaultSession: { drawerWidth: 50 },
      }),
    ).rejects.toThrow()
  })

  it('shrinks a drawer width that is too big', async () => {
    const { rootModel, pluginManager } = await createTestEnv({
      defaultSession: { width: 1024, drawerWidth: 256 },
    })
    rootModel.updateWidth(512)
    expect(rootModel.drawerWidth).toBe(256)
    render(rootModel, pluginManager)
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
