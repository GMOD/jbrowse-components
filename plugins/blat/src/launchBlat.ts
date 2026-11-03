import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import {
  addDisplayMenuItems,
  addViewMenuItems,
} from '@jbrowse/core/pluggableElementTypes'
import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import {
  assembleLocString,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import SearchIcon from '@mui/icons-material/Search'

import BlatDialog from './BlatDialog.tsx'
import { blatLengthsProblem } from './blatQuery.ts'
import {
  regionQueryName,
  softClippedQueries,
  toFasta,
} from './launchQueries.ts'

import type { NamedSequence } from './launchQueries.ts'
import type { UcscHost } from './ucscShared.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'
// for the registry entries that type the views and displays the menus extend;
// a runtime import would bundle both plugins into the UMD build
/* eslint-disable unicorn/require-module-specifiers */
import type {} from '@jbrowse/plugin-alignments'
import type {} from '@jbrowse/plugin-linear-genome-view'
/* eslint-enable unicorn/require-module-specifiers */

export function openBlatDialog(
  session: UcscHost,
  initial: { initialSequence?: string; initialAssembly?: string } = {},
) {
  session.queueDialog(handleClose => [
    BlatDialog,
    { session, handleClose, ...initial },
  ])
}

async function regionSequences(
  { rpcManager, assemblyManager }: AbstractSessionModel,
  regions: Region[],
) {
  return Promise.all(
    regions.map(async region => {
      const assembly = assemblyManager.get(region.assemblyName)
      const adapterConfig = assembly
        ? getSequenceAdapterConfig(assembly)
        : undefined
      if (!adapterConfig) {
        throw new Error(`No sequence for assembly ${region.assemblyName}`)
      }
      const [feature] = await rpcManager.call(
        'blatSelection',
        'CoreGetFeatures',
        // at most BLAT's 50 kb, which the item's length check enforces before
        // it can be clicked: too short to need stopping or a progress bar
        // eslint-disable-next-line no-restricted-syntax
        { adapterConfig, regions: [region] },
      )
      const seq = feature?.get('seq')
      if (typeof seq !== 'string') {
        throw new Error(`No sequence found for ${assembleLocString(region)}`)
      }
      return { name: regionQueryName(region), seq }
    }),
  )
}

function blatItem({
  label,
  lengths,
  onClick,
}: {
  label: string
  lengths: number[]
  onClick: () => void
}) {
  const problem = blatLengthsProblem(lengths)
  return {
    label,
    icon: SearchIcon,
    disabled: !!problem,
    disabledHelpText: problem,
    onClick,
  }
}

function blatSequences(
  session: UcscHost,
  assembly: string,
  sequences: NamedSequence[],
) {
  openBlatDialog(session, {
    initialSequence: toFasta(sequences),
    initialAssembly: assembly,
  })
}

/**
 * BLAT launched from what is on screen: the bases under a rubberband, and a
 * read or its soft clips, whose other placement is the question a clipped read
 * raises. Each opens the dialog filled in rather than submitting, since a
 * query spends a slot of a budget shared with every other user.
 */
export function addBlatMenuItems(pluginManager: PluginManager) {
  addViewMenuItems(pluginManager, 'LinearGenomeView', {
    menu: 'rubberBandLaunchMenuItems',
    items: self => {
      const regions = self.getSelectedRegions(self.leftOffset, self.rightOffset)
      return regions.length
        ? blatItem({
            label: 'BLAT selection',
            lengths: regions.map(region => region.end - region.start),
            onClick: () => {
              const session = getSession(self)
              regionSequences(session, regions).then(
                sequences => {
                  blatSequences(session, regions[0]!.assemblyName, sequences)
                },
                (error: unknown) => {
                  session.notifyError(
                    'Could not fetch the selected sequence',
                    error,
                  )
                },
              )
            },
          })
        : undefined
    },
  })

  addDisplayMenuItems(pluginManager, 'LinearAlignmentsDisplay', {
    menu: 'contextMenuItems',
    group: LAUNCH_LABEL,
    // offered once the read has been fetched, since what can be searched
    // depends on its bases and CIGAR; the fetch landing rebuilds this menu
    items: self => {
      const feature = self.contextMenuFeature
      const seq = feature?.get('seq')
      const cigar = feature?.get('CIGAR')
      const name = feature?.get('name') ?? 'read'
      const session = getSession(self)
      const assembly = getContainingView(self).assemblyNames?.[0]
      if (typeof seq === 'string' && seq && assembly) {
        const read = [{ name, seq }]
        const clips =
          typeof cigar === 'string'
            ? softClippedQueries({ name, cigar, seq })
            : []
        return [
          blatItem({
            label: 'BLAT read',
            lengths: [seq.length],
            onClick: () => {
              blatSequences(session, assembly, read)
            },
          }),
          ...(clips.length
            ? [
                blatItem({
                  label: 'BLAT soft-clipped bases',
                  lengths: clips.map(clip => clip.seq.length),
                  onClick: () => {
                    blatSequences(session, assembly, clips)
                  },
                }),
              ]
            : []),
        ]
      } else {
        return undefined
      }
    },
  })
}
