// The "Complete example" no-build plugin from
// website/docs/developer_guides/no_build_plugin.md, hosted so the tutorial's
// result figure (no_build_final) can be generated automatically instead of
// hand-captured.
//
// That guide's code fences are GENERATED FROM THIS FILE (`<!-- include: -->`),
// so editing here edits the published guide — run `pnpm sync-doc-snippets`
// after, and write comments for guide readers. The `// #region` marker is
// load-bearing.
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0'

  install(pluginManager) {
    const { ConfigurationSchema } = pluginManager.jbrequire(
      '@jbrowse/core/configuration',
    )
    const WidgetType = pluginManager.jbrequire(
      '@jbrowse/core/pluggableElementTypes/WidgetType',
    )
    const { ElementId } = pluginManager.jbrequire(
      '@jbrowse/core/util/types/mst',
    )
    const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')

    const React = pluginManager.jbrequire('react')

    const CiteWidget = () => {
      // React.createElement rather than JSX: JSX needs a build step, which is
      // the one thing a no-build plugin does not have.
      const header = React.createElement(
        'h1',
        null,
        'Cite this JBrowse session',
      )
      const content = React.createElement(
        'p',
        null,
        'Diesh, Colin, et al. "JBrowse 2: a modular genome browser with views of synteny and structural variation." Genome Biology 24, 74 (2023).',
      )

      return React.createElement('div', null, header, content)
    }

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'CiteWidget',
        heading: 'Cite this JBrowse session',
        configSchema: ConfigurationSchema('CiteWidget', {}),
        stateModel: types.model('CiteWidget', {
          id: ElementId,
          type: types.literal('CiteWidget'),
        }),
        ReactComponent: CiteWidget,
      })
    })
  }

  // #region configure
  configure(pluginManager) {
    // configure runs in the web worker too, and there is no rootModel there —
    // so guard on it before touching any menu
    if (pluginManager.rootModel) {
      // a new menu in the top toolbar, at index 4
      pluginManager.rootModel.insertMenu('Citations', 4)

      pluginManager.rootModel.appendToMenu('Citations', {
        label: 'Cite this JBrowse session',
        onClick: session => {
          const widget = session.addWidget('CiteWidget', 'citeWidget', {})
          session.showWidget(widget)
        },
      })
    }
  }
  // #endregion
}
