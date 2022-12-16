/* global JBrowseReactCircularGenomeView React, ReactDOM */
import assembly from './assembly.js'
import tracks from './tracks.js'
import defaultSession from './defaultSession.js'

const { createViewState, JBrowseCircularGenomeView } =
  JBrowseReactCircularGenomeView
const { createElement } = React
const { render } = ReactDOM

const updates = document.getElementById('update')
const state = new createViewState({
  assembly,
  tracks,
  defaultSession,
  onChange: patch => {
    updates.innerHTML += JSON.stringify(patch) + '\n'
  },
})

const textArea = document.getElementById('viewstate')
document.getElementById('showviewstate').addEventListener('click', () => {
  textArea.innerHTML = JSON.stringify(state.session.view, undefined, 2)
})

const domContainer = document.getElementById('jbrowse_circular_genome_view')
render(
  createElement(JBrowseCircularGenomeView, { viewState: state }),
  domContainer,
)
