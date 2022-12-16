/* global JBrowseReactLinearGenomeView React, ReactDOM */
import assembly from './assembly.js'
import tracks from './tracks.js'
import defaultSession from './defaultSession.js'

const { createViewState, JBrowseLinearGenomeView } =
  JBrowseReactLinearGenomeView

const updates = document.getElementById('update')

const state = new createViewState({
  assembly,
  tracks,
  defaultSession,
  onChange: patch => {
    updates.innerHTML += JSON.stringify(patch) + '\n'
  },
})

function navTo(event) {
  state.session.view.navToLocString(event.target.dataset.location)
}
const buttons = document.getElementsByTagName('button')
for (const button of buttons) {
  if (button.dataset.type === 'gene_button') {
    button.addEventListener('click', navTo)
  }
}

const textArea = document.getElementById('viewstate')
document.getElementById('showviewstate').addEventListener('click', () => {
  textArea.innerHTML = JSON.stringify(state.session.view, undefined, 2)
})

const domContainer = document.getElementById('jbrowse_linear_genome_view')
ReactDOM.render(
  React.createElement(JBrowseLinearGenomeView, { viewState: state }),
  domContainer,
)
