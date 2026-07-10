// The "Complete example" no-build plugin from
// website/docs/developer_guides/no_build_plugin.md, hosted so the tutorial's
// result figure (no_build_final) can be generated automatically instead of
// hand-captured. Keep this in sync with that doc's code block.
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
    const { ElementId } = pluginManager.jbrequire('@jbrowse/core/util/types/mst')
    const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')

    const React = pluginManager.jbrequire('react')

    const CiteWidget = () => {
      const header = React.createElement('h1', null, 'Cite this JBrowse session')
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

  configure(pluginManager) {
    if (pluginManager.rootModel) {
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
}
