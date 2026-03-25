// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app2'
import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const WithImportConfigJson = () => {
  const state = createViewState({
    config,
  })
  state.session.views[0]?.showTrack('volvox_cram')

  return (
    <div>
      <JBrowseApp viewState={state} />
    </div>
  )
}
