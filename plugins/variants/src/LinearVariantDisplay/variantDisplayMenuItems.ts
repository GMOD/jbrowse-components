import { makeSizeMenu } from '@jbrowse/core/ui'
import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  groupByRadioMenuItem,
  hiddenGroupsItems,
  resetSectionOrderItems,
} from '@jbrowse/display-kit/groupByMenu'
import { rampEncodingOf } from '@jbrowse/display-kit/valueRamp'
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
import { recordHueField } from '../shared/cellHue.ts'
import { capitalizeFirst } from '../shared/constants.ts'
import { PHASE_SET_FIELD } from '../shared/getPhasedColor.ts'
// lazy: this file is reached from a state model, so a dialog named here is in
// every host's first paint — see ./lazyDialogs.ts
import {
  CellColorFieldDialog,
  MultiSampleVariantClusterDialog as ClusterDialog,
  JexlFilterDialog,
  RecordsFacetFieldDialog,
} from '../shared/lazyDialogs.ts'
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
            label: 'Reference alleles',
            helpText:
              'When this setting is off, the background is colored solid grey and only ALT alleles are colored on top of it. This makes it easier to see potentially overlapping structural variants',
            type: 'checkbox' as const,
            checked: self.referenceDrawingMode !== 'skip',
            onClick: () => {
              self.setReferenceDrawingMode(
                self.referenceDrawingMode === 'skip' ? 'draw' : 'skip',
              )
            },
          },
          {
            label: 'Records',
            helpText:
              'Draw every record above the genotype rows at its genomic position, stacked as a variant track stacks them, colored by SV type and labelled with the share of samples carrying it. The band adds its height to the track: it opens as tall as its records need and keeps that height as you pan, and dragging its lower edge resizes it. Records that do not fit hide, counted beside the band',
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
  const facet = self.recordsFacet
  const drawn = self.recordsRenderedLabels
  return [
    ...hiddenGroupsItems({
      hiddenGroups: self.recordsHiddenGroups,
      showAllGroups: () => {
        self.showAllRecordsGroups()
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
    ...labelCheckboxItems({
      showNames: self.recordsLabels.name !== '',
      showDescriptions: self.recordsLabels.description !== '',
      showLabels: drawn.showLabels,
      effectiveShowDescriptions: drawn.showDescriptions,
      displayMode: self.recordsDisplayMode,
      labelFitHints: {},
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
  return self.showRecords && !self.drawsRows
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
  const recordsField = self.recordsFacet?.field
  return !self.drawsRows
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
              label: recordsField ? `Field (${recordsField})...` : 'Field...',
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  RecordsFacetFieldDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ],
        }),
      ]
    : self.rowColorFields.length
      ? [
          groupByRadioMenuItem({
            current: self.facet?.field,
            options: self.rowColorFields.map(attr => ({
              type: attr,
              label: capitalizeFirst(attr),
            })),
            onSelect: attr => {
              self.facetByField(attr)
            },
            onNone: () => {
              self.facetByField('')
            },
          }),
        ]
      : []
}

// Items for the "Show" submenu; the subtree filter has its own entry via
// `clusteringMenuItem`.
export function variantShowSubmenuItems(
  self: LinearVariantDisplayModel,
): MenuItem[] {
  return [
    ...(self.adapterSamples?.length
      ? [
          {
            label: 'Genotype rows',
            helpText:
              'Draw a row per sample. Off, the display reads no genotypes and the track is the records band alone; the rows come back at the height they had',
            type: 'checkbox' as const,
            checked: self.showGenotypes,
            onClick: () => {
              self.setShowGenotypes(!self.showGenotypes)
            },
          },
        ]
      : []),
    ...(self.drawsRows ? genotypeRowShowItems(self) : recordsShowItems(self)),
    {
      label: 'Tooltips',
      helpText:
        'Show the hover tooltip naming the genotype, the sample and the record under the pointer. Off, the crosshairs and the highlighted cell still follow the pointer — only the panel covering the rows beside it goes away',
      type: 'checkbox',
      checked: self.showTooltips,
      onClick: () => {
        self.setShowTooltips(!self.showTooltips)
      },
    },
    legendCheckboxItem(self),
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
          'Draw one equal-width column per variant in view, tied to its position by a line, so the genotype pattern across variants a few bases apart stays readable at any zoom. Off, each variant is drawn across the bases it covers, so a deletion reads as long as it is',
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
  const hueField =
    rampEncodingOf(self.colorEncoding)?.field ??
    recordHueField(self.colorEncoding)?.field
  const recordField = hueField === SV_TYPE_FIELD ? undefined : hueField
  const phaseSet = needs(
    'Phase set',
    'phase sets (FORMAT PS)',
    self.hasPhaseSet,
    loaded,
  )
  return [
    ...makeShowSubMenu(variantShowSubmenuItems(self)),
    // No presets: a cohort's useful row heights depend on how many samples it
    // has, so fit and a typed height are the two that mean anything here.
    ...(self.drawsRows ? [layoutMenuItem(self), rowHeightMenuItem(self)] : []),
    ...recordsHeightMenuItems(self),
    // the rows' own items, absent while no row draws
    ...(self.drawsRows
      ? [
          makeRadioSubMenu({
            label: 'Rows',
            icon: SplitscreenIcon,
            value: self.unit,
            onChange: unit => {
              self.setUnit(unit)
            },
            options: [
              {
                value: 'sample',
                label: 'Per sample',
                helpText:
                  'One row per sample. The color darkens with each copy of the allele the sample carries, so a homozygous call reads darker than a heterozygous one, at any ploidy',
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
                  'One row per haplotype, which needs phased genotypes: a diploid SAMPLE1 becomes rows SAMPLE1 HP0 and SAMPLE1 HP1, and a 1|0 call draws in the first row only. A row holds one allele, so there is no dosage shading. A haploid sample keeps one row, under its own name',
              },
            ],
          }),
        ]
      : []),
    // The cell fill and the sample metadata's row color are independent
    // color objects, so each is a block of its own. With no rows the fill
    // paints the records, which a phase set, a dosage or a sample cannot.
    colorByMenuItem({
      blocks: [
        {
          header: self.drawsRows ? 'Cells' : 'Records',
          rows: [
            {
              ...(self.drawsRows
                ? {
                    label: 'Genotype',
                    helpText:
                      'Default coloring: allele dosage with a row per sample, the allele each haplotype carries with a row per haplotype',
                  }
                : {
                    label: 'Default',
                    helpText:
                      'Each structural variant in the color of its SV type, keyed, and every other record in the feature track default',
                  }),
              type: 'radio' as const,
              checked: self.colorEncoding === undefined,
              onClick: () => {
                self.setColorValue(undefined)
              },
            },
            ...(self.drawsRows
              ? [
                  {
                    ...phaseSet,
                    helpText:
                      'Color every alt-carrying cell by the phase set (FORMAT PS) its call belongs to, so one phasing block reads as a single hue along a haplotype row; ref and no-call cells keep their normal coloring',
                    type: 'radio' as const,
                    checked: self.colorField === PHASE_SET_FIELD,
                    disabled: phaseSet.disabled || self.unit !== 'haplotype',
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
              helpText:
                'Color every alt-carrying cell by the variant’s most severe SnpEff (ANN) / VEP (CSQ) consequence impact tier; ref and no-call cells keep their normal coloring',
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
              helpText:
                'Color every alt-carrying cell by the variant’s structural-variant class (deletion, duplication, insertion, inversion, ...); ref and no-call cells keep their normal coloring',
              type: 'radio',
              checked: self.colorField === SV_TYPE_FIELD,
              onClick: () => {
                self.colorByField(SV_TYPE_FIELD)
              },
            },
            {
              label: recordField ? `Field (${recordField})...` : 'Field...',
              helpText:
                'Color every alt-carrying cell by a field of its record — an INFO field such as CLNSIG, QUAL, FILTER, or a computed value such as maf — one color per value, or per range between cut points for a number',
              type: 'radio',
              checked: !!recordField,
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
            self.drawsRows &&
            (self.rowColorFieldsOffered.length || self.rowColorChoice)
              ? rowColorItems(self)
              : [],
        },
      ],
      additional: [
        // Only in allele-count mode: a phased row is one haplotype, which either
        // carries the allele or does not, so the ramp has nothing to express.
        ...(self.unit === 'haplotype' || !self.drawsRows
          ? []
          : [
              {
                label: 'Shade by dosage',
                helpText:
                  "Compose the cell color with the genotype's alt dosage — the fraction of its called alleles that are non-reference — so a homozygote paints the hue itself and a heterozygote a lighter version of it. Off paints every alt-carrying cell the flat hue its color mode chose",
                type: 'checkbox' as const,
                checked: self.shadeByDosage,
                onClick: () => {
                  self.setShadeByDosage(!self.shadeByDosage)
                },
              },
            ]),
      ],
    }),
    // The banding half of the sample metadata, beside the coloring half.
    ...groupByMenuItems(self),
    ...filterMenuItems({
      // every field of the one `filter` list, each counted by whether it
      // differs from what the track's config declares (ADR-204), so an
      // admin's cutoff is no narrowing of the user's
      narrowings: { filter: filterFieldNarrowing(self, () => true) },
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
      subItems: !self.drawsRows
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
    ...(self.drawsRows
      ? rowOrderMenuItems(self, {
          arrangement: {
            ready: self.clusteringReady && !!self.adapterSamples?.length,
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
            rowCount: self.sources.length,
          },
        })
      : []),
  ]
}

// Right-click context-menu items for the record under the pointer, a record
// in the band or a genotype cell's: the feature track's rows on the record
// (plugin-features's `featureRecordMenuItems`), then the rows.
export function variantContextMenuItems(
  self: LinearVariantDisplayModel,
): MenuItem[] {
  const feat = self.contextMenuInfo?.feature
  const hit = feat && self.recordMenuHit(feat)
  const recordRows = hit && featureRecordMenuItems(self, hit)
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
        sortRowsHereMenuItem({
          label: 'Sort rows by genotype here',
          rowCount: self.editableSources.length,
          onClick: () => {
            self.sortByGenotype(feat.id())
          },
        }),
        // the undo for the item above, in the menu it was invoked from — the
        // same item the track menu spreads, so it must not read as two actions
        ...resetRowOrderMenuItems(self),
        ...(recordRows ? recordRows.copy : []),
      ]
    : []
}
