import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { saveAs } from 'file-saver'
import { observable, transaction } from 'mobx'
import { types } from 'mobx-state-tree'

import { Curves } from './components/Icons'
import baseModel from '../LinearComparativeView/model'

import type { ExportSvgOptions, ImportFormSyntenyTrack } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))
const DiagonalizationProgressDialog = lazy(
  () => import('./components/DiagonalizationProgressDialog'),
)

/**
 * #stateModel LinearSyntenyView
 * extends
 * - [LinearComparativeView](../linearcomparativeview)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearSyntenyView',
      baseModel(pluginManager),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property/
         */
        drawCIGAR: true,
        /**
         * #property/
         */
        drawCIGARMatchesOnly: false,
        /**
         * #property
         */
        drawCurves: false,
        /**
         * #property
         */
        drawLocationMarkers: false,
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
      /**
       * #volatile
       */
      diagonalizationProgress: 0,
      /**
       * #volatile
       */
      diagonalizationMessage: '',
    }))
    .actions(self => ({
      /**
       * #action
       */
      importFormRemoveRow(idx: number) {
        self.importFormSyntenyTrackSelections.splice(idx, 1)
      },
      /**
       * #action
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
      /**
       * #action
       */
      setImportFormSyntenyTrack(arg: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[arg] = val
      },
      /**
       * #action
       */
      setDrawCurves(arg: boolean) {
        self.drawCurves = arg
      },
      /**
       * #action
       */
      setDrawCIGAR(arg: boolean) {
        self.drawCIGAR = arg
      },
      /**
       * #action
       */
      setDrawCIGARMatchesOnly(arg: boolean) {
        self.drawCIGARMatchesOnly = arg
      },
      /**
       * #action
       */
      setDrawLocationMarkers(arg: boolean) {
        self.drawLocationMarkers = arg
      },
      /**
       * #action
       */
      setDiagonalizationProgress(progress: number, message: string) {
        self.diagonalizationProgress = progress
        self.diagonalizationMessage = message
      },
      /**
       * #action
       */
      showAllRegions() {
        transaction(() => {
          for (const view of self.views) {
            view.showAllRegionsInAssembly()
          }
        })
      },
      /**
       * #action
       * Diagonalize the synteny view by reordering and reorienting displayed
       * regions based on alignment data. This minimizes crossing lines in the
       * visualization.
       */
      async diagonalize() {
        const session = getSession(self)

        // Open progress dialog
        let dialogHandle: (() => void) | undefined
        session.queueDialog(handleClose => {
          dialogHandle = handleClose
          return [
            DiagonalizationProgressDialog,
            {
              handleClose,
              model: self,
            },
          ]
        })

        // Helper to update progress
        const updateProgress = (progress: number, message: string) => {
          self.setDiagonalizationProgress(progress, message)
          // Small delay to allow UI to update
          return new Promise(resolve => setTimeout(resolve, 0))
        }

        try {
          // Only works with exactly 2 views (reference and query)
          if (self.views.length !== 2) {
            await updateProgress(100, 'Error: Requires exactly 2 views')
            session.notify('Diagonalization requires exactly 2 views', 'warning')
            return
          }

          const [refView, queryView] = self.views

          console.log('Reference view assembly:', refView.assemblyNames)
          console.log('Query view assembly:', queryView.assemblyNames)
          console.log('Reference view regions:', refView.displayedRegions.map(r => r.refName))
          console.log('Query view regions:', queryView.displayedRegions.map(r => r.refName))

          await updateProgress(5, 'Collecting alignment data...')

          // Collect all alignment data from all synteny tracks
          interface AlignmentData {
            queryRefName: string
            refRefName: string
            queryStart: number
            queryEnd: number
            refStart: number
            refEnd: number
            strand: number
          }

          const alignments: AlignmentData[] = []

          for (const level of self.levels) {
            console.log('Processing level:', level.level)
            for (const track of level.tracks) {
              for (const display of track.displays) {
                const { featPositions } = display as {
                  featPositions: {
                    f: {
                      get: (key: string) => unknown
                    }
                  }[]
                }

                console.log('FeatPositions count:', featPositions.length)

                for (const { f } of featPositions) {
                  const mate = f.get('mate') as {
                    refName: string
                    start: number
                    end: number
                  }

                  const queryRefName = f.get('refName') as string
                  const refRefName = mate.refName
                  const queryStart = f.get('start') as number
                  const queryEnd = f.get('end') as number
                  const refStart = mate.start
                  const refEnd = mate.end
                  const strand = (f.get('strand') as number) || 1

                  alignments.push({
                    queryRefName,
                    refRefName,
                    queryStart,
                    queryEnd,
                    refStart,
                    refEnd,
                    strand,
                  })
                }
              }
            }
          }

          console.log('Total alignments collected:', alignments.length)
          if (alignments.length > 0) {
            console.log('Sample alignment:', alignments[0])
          }

          if (alignments.length === 0) {
            await updateProgress(100, 'No alignments found')
            session.notify('No alignments found to diagonalize', 'warning')
            return
          }

          await updateProgress(
            20,
            `Grouping ${alignments.length} alignments by query...`,
          )

          // Group alignments by query refName
          const queryGroups = new Map<
            string,
            {
              refAlignments: Map<string, { bases: number; positions: number[] }>
              strandWeightedSum: number
            }
          >()

          for (const aln of alignments) {
            if (!queryGroups.has(aln.queryRefName)) {
              queryGroups.set(aln.queryRefName, {
                refAlignments: new Map(),
                strandWeightedSum: 0,
              })
            }

            const group = queryGroups.get(aln.queryRefName)!
            const alnLength = Math.abs(aln.queryEnd - aln.queryStart)

            // Track aligned bases per reference region
            if (!group.refAlignments.has(aln.refRefName)) {
              group.refAlignments.set(aln.refRefName, {
                bases: 0,
                positions: [],
              })
            }

            const refData = group.refAlignments.get(aln.refRefName)!
            refData.bases += alnLength
            refData.positions.push((aln.refStart + aln.refEnd) / 2)

            // Calculate weighted strand sum
            const direction = aln.strand >= 0 ? 1 : -1
            group.strandWeightedSum += direction * alnLength
          }

          await updateProgress(50, 'Determining optimal ordering and orientation...')

          // Determine ordering and orientation for query regions
          const queryOrdering: {
            refName: string
            bestRefName: string
            bestRefPos: number
            shouldReverse: boolean
          }[] = []

          for (const [queryRefName, group] of queryGroups) {
            // Find reference region with most aligned bases
            let bestRefName = ''
            let maxBases = 0
            let bestPositions: number[] = []

            for (const [refName, data] of group.refAlignments) {
              if (data.bases > maxBases) {
                maxBases = data.bases
                bestRefName = refName
                bestPositions = data.positions
              }
            }

            // Calculate weighted mean position in reference
            const bestRefPos =
              bestPositions.reduce((a, b) => a + b, 0) / bestPositions.length

            // Determine if we should reverse based on major strand
            const shouldReverse = group.strandWeightedSum < 0

            queryOrdering.push({
              refName: queryRefName,
              bestRefName,
              bestRefPos,
              shouldReverse,
            })
          }

          await updateProgress(70, `Sorting ${queryOrdering.length} query regions...`)

          // Sort query regions by reference region and position
          queryOrdering.sort((a, b) => {
            // First by reference region name
            if (a.bestRefName !== b.bestRefName) {
              return a.bestRefName.localeCompare(b.bestRefName)
            }
            // Then by position within reference
            return a.bestRefPos - b.bestRefPos
          })

          await updateProgress(85, 'Building new region layout...')

          // Build new displayedRegions for query view
          const newQueryRegions = []
          const currentQueryRegions = queryView.displayedRegions

          console.log('Query ordering:', queryOrdering)
          console.log('Current query regions:', currentQueryRegions.map(r => ({
            refName: r.refName,
            assemblyName: r.assemblyName,
          })))

          for (const { refName, shouldReverse } of queryOrdering) {
            const region = currentQueryRegions.find(r => r.refName === refName)
            if (region) {
              newQueryRegions.push({
                ...region,
                reversed: shouldReverse,
              })
            } else {
              console.warn(`Could not find region for refName: ${refName}`)
            }
          }

          console.log('New query regions count:', newQueryRegions.length)

          // Apply the new ordering
          if (newQueryRegions.length > 0) {
            await updateProgress(95, 'Applying new layout...')
            transaction(() => {
              queryView.setDisplayedRegions(newQueryRegions)
            })
            await updateProgress(100, 'Diagonalization complete!')
            session.notify(
              `Successfully diagonalized ${newQueryRegions.length} query regions`,
              'success',
            )
          } else {
            await updateProgress(100, 'No regions to reorder')
            session.notify('No query regions found to reorder', 'warning')
          }
        } catch (error) {
          console.error('Diagonalization error:', error)
          await updateProgress(100, `Error: ${error}`)
          session.notify(`Diagonalization failed: ${error}`, 'error')
        } finally {
          // Auto-close dialog after a brief delay
          setTimeout(() => {
            dialogHandle?.()
          }, 1500)
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } = await import(
          './svgcomponents/SVGLinearSyntenyView'
        )
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
      },
    }))
    .views(self => {
      const superHeaderMenuItems = self.headerMenuItems
      const superMenuItems = self.menuItems
      return {
        /**
         * #method
         * includes a subset of view menu options because the full list is a
         * little overwhelming
         */
        headerMenuItems() {
          return [
            ...superHeaderMenuItems(),
            {
              label: 'Square view',
              onClick: self.squareView,
              description:
                'Makes both views use the same zoom level, adjusting to the average of each',
              icon: CropFreeIcon,
            },
            {
              label: 'Show all regions',
              onClick: self.showAllRegions,
              description: 'Show entire genome assemblies',
              icon: VisibilityIcon,
            },
            {
              label: 'Diagonalize',
              onClick: () => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                self.diagonalize()
              },
              description:
                'Reorder and reorient query regions to minimize crossing lines',
            },
            {
              label: 'Draw CIGAR',
              checked: self.drawCIGAR,
              type: 'checkbox',
              description:
                'If disabled, only draws the broad scale CIGAR match',
              onClick: () => {
                self.setDrawCIGAR(!self.drawCIGAR)
              },
            },
            {
              label: 'Draw only CIGAR matches',
              checked: self.drawCIGARMatchesOnly,
              type: 'checkbox',
              description:
                'If enabled, it hides the insertions and deletions in the CIGAR strings, helps with divergent',
              onClick: () => {
                self.setDrawCIGARMatchesOnly(!self.drawCIGARMatchesOnly)
              },
            },
            {
              label: 'Link views',
              type: 'checkbox',
              checked: self.linkViews,
              icon: LinkIcon,
              onClick: () => {
                self.setLinkViews(!self.linkViews)
              },
            },
            {
              label: 'Use curved lines',
              type: 'checkbox',
              checked: self.drawCurves,
              icon: Curves,
              onClick: () => {
                self.setDrawCurves(!self.drawCurves)
              },
            },
            {
              label: 'Draw location markers',
              type: 'checkbox',
              checked: self.drawLocationMarkers,
              description:
                'Draw periodic markers to show location within large matches',
              onClick: () => {
                self.setDrawLocationMarkers(!self.drawLocationMarkers)
              },
            },
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: (): void => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
        /**
         * #method
         */
        menuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
