import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import './fonts/material-icons.css'
import 'typeface-roboto'
import JBrowse from './JBrowse'

import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

async function main() {
  const jbrowse = new JBrowse()

  // this is the main process, so start and register our service worker and web workers
  serviceWorker.register()
  const workerGroups = webWorkers.register()
  jbrowse.workerManager.addWorkers(workerGroups)

  // add the initial configuration
  await jbrowse.configure({ uri: 'test_data/config.json' })

  // poke some things for testing (this stuff will eventually be removed)
  const { model } = jbrowse
  window.jbrowse = jbrowse
  window.MODEL = model
  window.getSnapshot = getSnapshot
  window.resolveIdentifier = resolveIdentifier

  // finally, start the app
  jbrowse.start()
}

main()
