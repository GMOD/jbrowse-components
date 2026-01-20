import { getConf } from '@jbrowse/core/configuration'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { applyColorPalette } from './applyColorPalette.ts'

import type { Source } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Sets up an autorun that applies a color palette to sources based on the
 * colorBy config option when sources are first loaded.
 */
export function setupColorByAutorun(self: {
  configuration: AnyConfigurationModel
  sourcesVolatile: Source[] | undefined
  layout: Source[]
  colorByApplied: boolean
  setLayout: (layout: Source[], clearTree?: boolean) => void
  setColorByApplied: (value: boolean) => void
}) {
  addDisposer(
    self,
    autorun(
      () => {
        if (!isAlive(self)) {
          return
        }

        // Only apply once
        if (self.colorByApplied) {
          return
        }

        // Wait for sources to be loaded
        const sources = self.sourcesVolatile
        if (!sources || sources.length === 0) {
          return
        }

        // Don't override existing layout (user customization)
        if (self.layout.length > 0) {
          self.setColorByApplied(true)
          return
        }

        // Check if colorBy config is set
        const colorBy = getConf(self, 'colorBy') as string
        if (!colorBy) {
          self.setColorByApplied(true)
          return
        }

        // Check if the attribute exists in the sources
        const hasAttribute = sources.some(source => colorBy in source)
        if (!hasAttribute) {
          console.warn(
            `colorBy attribute "${colorBy}" not found in sample metadata. ` +
              `Available attributes: ${Object.keys(sources[0] || {}).join(', ')}`,
          )
          self.setColorByApplied(true)
          return
        }

        // Apply the color palette
        const coloredSources = applyColorPalette(sources, colorBy)
        self.setLayout(coloredSources, false)
        self.setColorByApplied(true)
      },
      {
        name: 'ColorByAutorun',
      },
    ),
  )
}
