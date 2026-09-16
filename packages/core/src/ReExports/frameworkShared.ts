// The framework singletons both realms serve for real — one object, imported
// by the main-thread map and the generated worker map, so a plugin's React and
// MST are the host's in the worker too and the two maps hold the same values.
// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

import * as mst from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'
import * as ReactJSXRuntime from 'react/jsx-runtime'

const frameworkShared = {
  react: React,
  'react/jsx-runtime': ReactJSXRuntime,
  mobx,
  '@jbrowse/mobx-state-tree': mst,
  'mobx-state-tree': mst,
}

export default frameworkShared
