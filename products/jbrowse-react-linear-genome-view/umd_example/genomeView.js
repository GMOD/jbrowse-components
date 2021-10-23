/* global JBrowseReactLinearGenomeView React, ReactDOM */
import assembly from './assembly.js'
import tracks from './tracks.js'

const { createViewState, JBrowseLinearGenomeView } =
  JBrowseReactLinearGenomeView
const { createElement } = React
const { render } = ReactDOM

const updates = document.getElementById('update')
const state = new createViewState({
  assembly,
  tracks,
  location: '1:100,987,269..100,987,368',
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
render(
  createElement(JBrowseLinearGenomeView, { viewState: state }),
  domContainer,
)
