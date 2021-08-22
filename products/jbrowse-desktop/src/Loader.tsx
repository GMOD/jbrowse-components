import React, { useState } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'

import JBrowse from './JBrowse'
import StartScreen from './StartScreen'

export default function Loader() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  return pluginManager ? (
    <JBrowse pluginManager={pluginManager} />
  ) : (
    <StartScreen setPluginManager={setPluginManager} />
  )
}
