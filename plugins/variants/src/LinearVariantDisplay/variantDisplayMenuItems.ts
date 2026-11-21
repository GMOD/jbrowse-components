import { makeSizeMenu } from '@jbrowse/core/ui'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { filterMenuItems, undoItems } from '@jbrowse/core/ui/filterMenuItems'
import {
  TRACK_MENU_PRIORITY,
  makeRadioSubMenu,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost, pluralize } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { legendMenuItems } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  groupByRadioMenuItem,
  groupByRowAttributeMenuItems,
  hiddenGroupsItems,
  resetSectionOrderItems,
} from '@jbrowse/display-kit/groupByMenu'
import { fieldHeading } from '@jbrowse/display-kit/sectionsHeading'
import { sectionsMenuItemsFor } from '@jbrowse/display-kit/sectionsMenu'
import {
  featureHeightMenuItem,
  featureHighlightMenuItems,
  featureRecordMenuItems,
  labelCheckboxItems,
  trackSizingItems,
} from '@jbrowse/plugin-features/band'
import {
  resetRowOrderMenuItems,
  rowOrderMenuItems,
  rowColorChoiceLabel,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

import { breakendSplitViewMenuItem } from '../shared/breakendSplitViewMenuItem.ts'
import { PHASE_SET_FIELD } from '../shared/getPhasedColor.ts'
// lazy: this file is reached from a state model, so a dialog named here is in
// every host's first paint — see ./lazyDialogs.ts
import {
  CellColorFieldDialog,
  MultiSampleVariantClusterDialog as ClusterDialog,
  JexlFilterDialog,
  RecordsFacetFieldDialog,
} from '../shared/lazyDialogs.ts'
import { isSiteField } from '../shared/minorAlleleFrequencyUtils.ts'
import { IMPACT_FIELD } from '../shared/variantConsequence.ts'
import { VARIANT_FILTER_EXAMPLES } from '../shared/variantFilterExamples.ts'
import { variantFilterFields } from '../shared/variantFilterFields.ts'
import { sortReadsMenuItems } from './sortReadsMenu.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A row that needs something in the fetched window, greyed with the reason
// until it is there
function needs(label: string, what: string, present: boolean, loaded: boolean) {
  return present
    ? { label, disabled: false }
    : {
        label: `${label} (${loaded ? `no ${what} in view` : `checking for ${what}...`})`,
        disabled: true,
      }
}

// The rows' color, as the arrangement dialog offers it: None and the
// attributes, and Each row while it is the choice, since its colors are
// picked in the dialog.
function rowColorItems(self: LinearVariantDisplayModel): MenuItem[] {
  const current = self.rowColorChoice
  return [
    '',
    ...(current === 'name' ? ['name'] : []),
    ...self.rowColorFieldsOffered,
  ].map(choice => ({
    label: rowColorChoiceLabel(choice),
    type: 'radio' as const,
    checked: current === choice,
    onClick: () => {
      self.setRowColorChoice(choice)
    },
  }))
}

// The row-only "Show" items, absent while the records are the display.
function genotypeRowShowItems(self: LinearVariantDisplayModel): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    showRowSeparatorsMenuItem(self),
    // columns always draw reference cells, so the toggle is genomic-only
    ...(self.atGenomicPositions
      ? [
          {
            label: 'Show reference alleles',
            helpText:
              'Off greys the background and colors only ALT alleles, so overlapping structural variants are easier to see',
            type: 'checkbox' as const,
            checked: self.showReference,
            onClick: () => {
              self.setShowReference(!self.showReference)
            },
          },
          {
            label: 'Show records',
            type: 'checkbox' as const,
            checked: self.showRecords,
            onClick: () => {
              self.setShowRecords(!self.showRecords)
            },
          },
        ]
      : []),
  ]
}

// With no rows the records are the display, and show what a feature track's
// "Show" menu does: the way back from hidden sections, and the label parts.
function recordsShowItems(self: LinearVariantDisplayModel): MenuItem[] {
  const { lettered } = self.recordsLabelPlan
  return [
    ...hiddenGroupsItems({
      hiddenGroups: self.recordsHiddenGroups,
      showAllGroups: () => {
        self.showAllRecordsGroups()
      },
    }),
    ...labelCheckboxItems({
      showNames: self.recordsLabels.name !== '',
      showDescriptions: self.recordsLabels.description !== '',
      showLabels: lettered.names,
      effectiveShowDescriptions: lettered.descriptions,
      displayMode: self.recordsDisplayMode,
      labelFitHints: self.recordsLabelFitHints,
      setShowNames: show => {
        self.setRecordsLabelShow('name', show)
      },
      setShowDescriptions: show => {
        self.setRecordsLabelShow('description', show)
      },
    }),
  ]
}

// The records' height preset, while no row draws. Over rows the band's seam
// handle sizes it and its fit ladder shrinks what does not fit, so a preset
// there would be a second "height" beside Row height.
function recordsHeightMenuItems(self: LinearVariantDisplayModel): MenuItem[] {
  return !self.drawsGenotypeRows
    ? [
        featureHeightMenuItem({
          displayMode: self.recordsDisplayMode,
          setDisplayMode: mode => {
            self.setRecordsDisplayMode(mode)
          },
          trackSizing: self.recordsOnly ? trackSizingItems(self) : [],
        }),
      ]
    : []
}

const RECORD_FIELD = 'field' as const

// With no rows the records group into sections by a record field, as on a
// feature track; over rows the sample attributes band the rows.
function groupByMenuItems(self: LinearVariantDisplayModel): MenuItem[] {
  const facet = self.recordsFacet
  const recordsField = facet?.field
  return !self.drawsGenotypeRows
    ? [
        groupByRadioMenuItem<never, typeof RECORD_FIELD>({
          current: recordsField ? RECORD_FIELD : undefined,
          options: [],
          onSelect: () => {},
          onNone: () => {
            self.recordsFacetByField('')
          },
          extra: [
            {
              type: RECORD_FIELD,
              label: 'Field...',
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  RecordsFacetFieldDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ],
        }),
        ...sectionsMenuItemsFor(self, {
          get knownSections() {
            return self.recordsKnownSections
          },
          get hiddenGroups() {
            return self.recordsHiddenGroups
          },
          sectionsHeading: fieldHeading(recordsField),
          setHiddenGroups: keys => {
            self.setRecordsHiddenGroups(keys)
          },
        }),
        ...resetSectionOrderItems(
          facet && {
            domain: facet.sort,
            setDomain: domain => {
              self.setRecordsFacetSort(domain)
            },
          },
        ),
      ]
    : groupByRowAttributeMenuItems(self, self.rowColorFields)
}

// Items for the "Show" submenu; the subtree filter has its own entry via
// `clusteringMenuItem`.
function variantShowSubmenuItems(self: LinearVariantDisplayModel): MenuItem[] {
  return [
    ...(self.adapterSamples?.length
      ? [
          {
            label: 'Show genotype rows',
            helpText:
              'Off, the display reads no genotypes and shows the records alone',
            type: 'checkbox' as const,
            checked: self.showGenotypes,
            onClick: () => {
              self.setShowGenotypes(!self.showGenotypes)
            },
          },
        ]
      : []),
    ...(self.drawsGenotypeRows
      ? genotypeRowShowItems(self)
      : recordsShowItems(self)),
    {
      label: 'Show tooltips',
      type: 'checkbox',
      checked: self.showTooltips,
      onClick: () => {
        self.setShowTooltips(!self.showTooltips)
      },
    },
    ...legendMenuItems(self),
  ]
}

function layoutMenuItem(self: LinearVariantDisplayModel): MenuItem {
  return {
    label: 'Layout',
    icon: ViewQuiltIcon,
    subMenu: [
      {
        label: 'Genotype matrix',
        helpText:
          'One equal-width column per variant, so variants a few bases apart stay readable at any zoom',
        type: 'checkbox',
        checked: !self.atGenomicPositions,
        onClick: () => {
          self.setVariantLayout(self.atGenomicPositions ? 'columns' : 'genomic')
        },
      },
    ],
  }
}

// The display-specific track-menu items (row height, rows, filtering,
// clustering, colors/arrangement). The model's `trackMenuItems` view prepends
// the inherited base items via super-capture.
export function variantTrackMenuItems(
  self: LinearVariantDisplayModel,
): MenuItem[] {
  const loaded = !!self.cellData
  const { colorField } = self
  const recordFieldPicked = !new Set<string>([
    '',
    SV_TYPE_FIELD,
    IMPACT_FIELD,
    PHASE_SET_FIELD,
  ]).has(colorField)
  const phaseSet = needs(
    'Phase set',
    'phase sets (FORMAT PS)',
    self.hasPhaseSet,
    loaded,
  )
  return [
    // The cell fill and the sample metadata's row color are independent
    // color objects, so each is a block of its own. With no rows the fill
    // paints the records, which a phase set, a dosage or a sample cannot.
    colorByMenuItem({
      blocks: [
        {
          header: self.drawsGenotypeRows ? 'Cells' : 'Records',
          rows: [
            {
              ...(self.drawsGenotypeRows
                ? { label: 'Genotype' }
                : { label: 'Default' }),
              type: 'radio' as const,
              // with no rows a phase set, which no record holds, paints the
              // records as the default does
              checked: self.drawsGenotypeRows
                ? self.colorEncoding === undefined && colorField === ''
                : self.recordsColorBySvClass,
              onClick: () => {
                self.setColorValue(undefined)
              },
            },
            ...(self.drawsGenotypeRows
              ? [
                  {
                    ...phaseSet,
                    type: 'radio' as const,
                    checked: self.colorField === PHASE_SET_FIELD,
                    disabled:
                      phaseSet.disabled || self.rowsField !== 'haplotype',
                    disabledHelpText: phaseSet.disabled
                      ? undefined
                      : 'Only applies with a row per haplotype — switch Rows to Per haplotype',
                    onClick: () => {
                      self.colorByField(PHASE_SET_FIELD)
                    },
                  },
                ]
              : []),
            {
              ...needs(
                'Consequence impact',
                'SnpEff/VEP annotations',
                self.hasConsequence,
                loaded,
              ),
              type: 'radio',
              checked: self.colorField === IMPACT_FIELD,
              onClick: () => {
                self.colorByField(IMPACT_FIELD)
              },
            },
            {
              ...needs(
                'SV type',
                'structural variants',
                self.hasSvType,
                loaded,
              ),
              type: 'radio',
              checked: self.colorField === SV_TYPE_FIELD,
              onClick: () => {
                self.colorByField(SV_TYPE_FIELD)
              },
            },
            {
              label: 'Field...',
              type: 'radio',
              checked: recordFieldPicked,
              keepMenuOpen: false,
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  CellColorFieldDialog,
                  { model: self, handleClose },
                ])
              },
            },
            solidColorItem(
              typeof self.colorEncoding === 'string' &&
                !isJexl(self.colorEncoding),
              () => {
                self.pickSolidColor()
              },
            ),
          ],
        },
        {
          header: 'Samples',
          rows:
            self.drawsGenotypeRows &&
            (self.rowColorFieldsOffered.length || self.rowColorChoice)
              ? rowColorItems(self)
              : [],
        },
      ],
    }),
    // The banding half of the sample metadata, beside the coloring half.
    ...groupByMenuItems(self),
    ...filterMenuItems({
      // every field of the one `filter` list, each counted by whether it
      // differs from what the track's config declares (ADR-204), so an
      // admin's cutoff is no narrowing of the user's. With no rows the
      // worker tests no site field, so none counts and none clears; each
      // comes back with the rows.
      narrowings: {
        filter: filterFieldNarrowing(
          self,
          field => self.drawsGenotypeRows || !isSiteField(field),
        ),
      },
      onEdit: () => {
        getDialogHost(self).queueDialog(handleClose => [
          JexlFilterDialog,
          {
            model: self,
            handleClose,
            examples: VARIANT_FILTER_EXAMPLES,
            fields: variantFilterFields(self.fetchAdapterMetadata()),
          },
        ])
      },
      // Both are bounded fractions tuned by feel, so they're inline sliders
      // rather than a dialog round-trip. They're fetch inputs (rpcProps), so
      // commitOnRelease keeps a drag from firing a worker refetch per step.
      // Both read called alleles, so with no rows, which reads none, they go.
      subItems: !self.drawsGenotypeRows
        ? []
        : [
            makeSizeMenu({
              label: 'Minor allele frequency',
              title: 'MAF',
              min: 0,
              max: 0.5,
              step: 0.01,
              format: n => (n === 0 ? 'off' : n.toFixed(2)),
              commitOnRelease: true,
              getValue: () => self.minMinorAlleleFrequency,
              isDefault: self.minMinorAlleleFrequency === 0,
              onChange: n => {
                self.setMinMinorAlleleFrequency(n)
              },
              onReset: () => {
                self.setMinMinorAlleleFrequency(0)
              },
            }),
            makeSizeMenu({
              label: 'Missingness',
              title: 'Max missingness',
              min: 0,
              max: 1,
              step: 0.01,
              // 1 keeps every variant, i.e. the filter is off
              format: n => (n === 1 ? 'off' : n.toFixed(2)),
              commitOnRelease: true,
              getValue: () => self.maxMissingness,
              isDefault: self.maxMissingness === 1,
              onChange: n => {
                self.setMaxMissingness(n)
              },
              onReset: () => {
                self.setMaxMissingness(1)
              },
            }),
          ],
    }),
    ...makeShowSubMenu(variantShowSubmenuItems(self)),
    // the rows' own items, absent while no row draws
    ...(self.drawsGenotypeRows
      ? [
          makeRadioSubMenu({
            label: 'Rows',
            icon: SplitscreenIcon,
            value: self.rowsField,
            onChange: rowsField => {
              self.setRowsField(rowsField)
            },
            options: [
              {
                value: 'sample',
                label: 'Per sample',
              },
              {
                value: 'haplotype',
                // `hasPhasedOrHaploid`, the painter's own predicate: a pangenome
                // callset is haploid, with no `|` anywhere, and draws per haplotype
                ...needs(
                  'Per haplotype',
                  'phased genotypes',
                  self.hasPhasedOrHaploid,
                  loaded,
                ),
                helpText:
                  'Each row holds one allele, so there is no dosage shading',
              },
            ],
          }),
        ]
      : []),
    // No presets: a cohort's useful row heights depend on how many samples it
    // has, so fit and a typed height are the two that mean anything here.
    ...(self.drawsGenotypeRows
      ? [rowHeightMenuItem(self), layoutMenuItem(self)]
      : []),
    ...recordsHeightMenuItems(self),
    ...(self.drawsGenotypeRows
      ? rowOrderMenuItems(self, {
          arrangement: {
            ready: self.clusteringReady,
          },
          cluster: {
            runItem: {
              label: 'Cluster rows by genotype...',
              // Off the sample list, not `loaded`: the samples arrive on their own
              // RPC (`MultiSampleVariantGetSources`), which neither waits for the
              // cell data nor is waited on by it. Below that, the row count is
              // `clusteringMenuItem`'s gate.
              disabled: !self.adapterSamples,
              disabledHelpText: 'Loading samples...',
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  ClusterDialog,
                  { model: self, handleClose },
                ])
              },
            },
            rowCount: self.drawnRows.length,
          },
        })
      : []),
    ...undoItems(
      {
        highlights: {
          count: self.featureHighlights.length,
          label: n => `Clear ${n} ${pluralize(n, 'highlight')}`,
          icon: Highlighter,
          clear: () => {
            self.clearFeatureHighlights()
          },
        },
      },
      TRACK_MENU_PRIORITY.recovery,
    ),
  ]
}

// Right-click context-menu items for the record under the pointer, a record
// in the band or a genotype cell's: the feature track's rows on the record
// (plugin-features's `featureRecordMenuItems`), then the rows.
export function variantContextMenuItems(
  self: LinearVariantDisplayModel,
): MenuItem[] {
  const feat = self.contextMenuInfo?.feature
  const hit =
    feat && self.recordMenuHit(feat, self.contextMenuInfo?.displayedRegionIndex)
  const recordRows =
    hit &&
    featureRecordMenuItems(self, {
      ...hit,
      tooltipText: self.contextMenuInfo?.tooltipText,
    })
  return feat
    ? [
        // its own rather than the feature track's: a cell's details open on
        // the clicked sample's card
        {
          label: `Open ${self.featureNoun} details`,
          icon: MenuOpenIcon,
          onClick: () => {
            self.selectFeature(feat)
          },
        },
        ...(recordRows ? recordRows.navigate : []),
        ...(hit ? featureHighlightMenuItems(self, hit) : []),
        // Placed above "Sort by genotype" because they are about the record,
        // as the rows above are, where that sort is about the rows.
        ...breakendSplitViewMenuItem(self, feat),
        ...(hit
          ? sortReadsMenuItems(self, feat, hit.displayedRegionIndex)
          : []),
        // The shared row: one label shape and one `< 2 rows` gate across the
        // four displays that sort rows at a column. No helpText of its own, as
        // on those three — what the flanking tiebreak does to the rows around
        // the anchor is on `sortByGenotype`, which is where a reader of the
        // model docs looks for it.
        ...(self.drawsGenotypeRows
          ? [
              sortRowsHereMenuItem({
                label: 'Sort rows by genotype here',
                rowCount: self.arrangedRows.length,
                onClick: () => {
                  self.sortByGenotype(feat.id())
                },
              }),
              // the undo for the item above, in the menu it was invoked from —
              // the same item the track menu spreads, so it must not read as
              // two actions
              ...resetRowOrderMenuItems(self),
            ]
          : []),
        ...(recordRows ? recordRows.copy : []),
      ]
    : []
}
