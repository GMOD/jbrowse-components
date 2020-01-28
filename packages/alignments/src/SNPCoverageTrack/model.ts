import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { isAbortException, getSession } from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getParentRenderProps,
  getTrackAssemblyName,
} from '@gmod/jbrowse-core/util/tracks'
import blockBasedTrackModel, {
  BlockBasedTrackStateModel,
} from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'
import { autorun, observable } from 'mobx'
import { addDisposer, getSnapshot, isAlive, types } from 'mobx-state-tree'
import React from 'react'
import { getNiceDomain } from '@gmod/jbrowse-plugin-wiggle/src/util'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'
import SNPCoverageTrackComponent from './components/SNPCoverageTrackComponent'

// using a map because it preserves order
const rendererTypes = new Map([['snpxy', 'SNPXYRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types.compose(
    'SNPCoverageTrack',
    wiggleStateModelFactory(configSchema),
    types.model({ type: types.literal('SNPCoverageTrack') }).views(self => ({
      get rendererTypeName() {
        const viewName = getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType)
          throw new Error(`unknown wiggle renderer type ${viewName}`)
        return rendererType
      },

      get needsScalebar() {
        return true
      },
    })),
  )

export type SNPCoverageTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
