import React from 'react'
import ReactDOM from 'react-dom'
import {
  createViewState,
  defaultJBrowseTheme,
  JBrowseLinearView as JBrowseReactLinearView,
  loadPlugins,
  ThemeProvider,
} from '@gmod/jbrowse-react-linear-view'

export default class JBrowseLinearView {
  constructor(opts) {
    this.render(opts)
  }

  async render(opts) {
    const {
      container,
      assembly,
      tracks,
      configuration,
      plugins = [],
      location,
      defaultSession,
      onChange,
    } = opts
    const loadedPlugins = await loadPlugins(plugins)
    const state = createViewState({
      assembly,
      tracks,
      configuration,
      defaultSession,
      location,
      onChange,
      plugins: loadedPlugins,
    })
    this.state = state
    ReactDOM.render(
      <ThemeProvider theme={defaultJBrowseTheme}>
        <JBrowseReactLinearView viewState={state} />
      </ThemeProvider>,
      container,
    )
  }

  get view() {
    return this.state && this.state.view
  }
}
