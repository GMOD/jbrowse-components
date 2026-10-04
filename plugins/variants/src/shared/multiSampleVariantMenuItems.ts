import { makeSizeMenu } from '@jbrowse/core/ui'
import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { assembleLocString, getDialogHost } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { copyText } from '@jbrowse/core/util/copyText'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  colorForField,
  colorForValue,
} from '@jbrowse/display-kit/colorConfigSchema'
import {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { breakendSplitViewMenuItem } from './breakendSplitViewMenuItem.ts'
import { recordHueField } from './cellHue.ts'
import { capitalizeFirst } from './constants.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
// lazy: this file is reached from a state model, so a dialog named here is in
// every host's first paint — see ./lazyDialogs.ts
import {
  CellColorFieldDialog,
  CellSolidColorDialog,
  MultiSampleVariantClusterDialog as ClusterDialog,
  JexlFilterDialog,
} from './lazyDialogs.ts'
import { IMPACT_FIELD } from './variantConsequence.ts'
import { VARIANT_FILTER_EXAMPLES } from './variantFilterExamples.ts'
import { variantFilterFields } from './variantFilterFields.ts'

import type { MultiSampleVariantBaseModel } from './MultiSampleVariantBaseModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The sample-metadata radio group both "Color by..." and "Group by..." offer:
// the same candidate attributes (`colorByAttributes` — every samplesTsv column
// the sources carry), each with a None to turn the setting off.
function sampleAttributeItems(
  attributes: string[],
  current: string,
  onSelect: (attribute: string) => void,
): MenuItem[] {
  return [
    {
      label: 'None',
      type: 'radio',
      checked: !current,
      onClick: () => {
        onSelect('')
      },
    },
    ...attributes.map(attr => ({
      label: capitalizeFirst(attr),
      type: 'radio' as const,
      checked: current === attr,
      onClick: () => {
        onSelect(attr)
      },
    })),
  ]
}

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

// Paints the constant kept beside a field, where there is one, and opens the
// picker.
function pickCellSolidColor(self: MultiSampleVariantBaseModel) {
  const { value } = self.colorSetting
  if (self.colorField && value !== undefined && !isJexl(value)) {
    self.setColor(colorForField(self.colorSetting, ''))
  }
  getDialogHost(self).queueDialog(handleClose => [
    CellSolidColorDialog,
    { model: self, handleClose },
  ])
}

// The rows' colour, as the arrangement dialog offers it: none, or an
// attribute's values, the config's own among them where the samples lack it.
// No palette deals the rows by name here, so there is no Each row.
function rowColorItems(self: MultiSampleVariantBaseModel): MenuItem[] {
  const current = self.rowColorChoice
  const pick = (field: string) => () => {
    self.setRowColorField(field)
  }
  const attributes =
    current === '' || self.colorByAttributes.includes(current)
      ? self.colorByAttributes
      : [...self.colorByAttributes, current]
  return [
    {
      label: 'None',
      type: 'radio',
      checked: current === '',
      onClick: pick(''),
    },
    ...attributes.map(attr => ({
      label: capitalizeFirst(attr),
      type: 'radio' as const,
      checked: current === attr,
      onClick: pick(attr),
    })),
  ]
}

// Items for the "Show..." submenu. The display extends them via super-capture
// with its variant lane rows; the subtree filter has its own entry via
// `clusteringMenuItem`.
export function variantShowSubmenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    showRowSeparatorsMenuItem(self),
    legendCheckboxItem(self),
    // columns always draw reference cells, so the toggle is genomic-only
    ...(self.atGenomicPositions
      ? [
          {
            label: 'Show reference alleles',
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
        ]
      : []),
    {
      label: 'Show tooltips',
      helpText:
        'Show the hover tooltip naming the genotype, the sample and the record under the pointer. Off, the crosshairs and the highlighted cell still follow the pointer — only the panel covering the rows beside it goes away',
      type: 'checkbox',
      checked: self.showTooltips,
      onClick: () => {
        self.setShowTooltips(!self.showTooltips)
      },
    },
  ]
}

// The display-specific track-menu items (row height, rendering mode, filtering,
// clustering, colors/arrangement). The model's `trackMenuItems` view prepends
// the inherited base items via super-capture.
export function variantTrackMenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  const loaded = !!self.cellData
  const hueField = recordHueField(self.colorEncoding)?.field
  const recordField = hueField === SV_TYPE_FIELD ? undefined : hueField
  const phaseSet = needs(
    'Phase set',
    'phase sets (FORMAT PS)',
    self.hasPhaseSet,
    loaded,
  )
  return [
    ...makeShowSubMenu(self.showSubmenuItems()),
    // No presets: a cohort's useful row heights depend on how many samples it
    // has, so fit and a typed height are the two that mean anything here.
    rowHeightMenuItem(self),
    {
      label: 'Rendering mode',
      icon: SplitscreenIcon,
      subMenu: [
        {
          label: 'Allele count (dosage)',
          helpText:
            'Draws the color darker the more times this allele exists, so homozygous variants are darker than heterozygous. Works on polyploid also',
          type: 'radio',
          checked: self.renderingMode === 'alleleCount',
          onClick: () => {
            self.setPhasedMode('alleleCount')
          },
        },
        {
          // `hasPhasedOrHaploid`, the painter's own predicate: a pangenome
          // callset is haploid, with no `|` anywhere, and phased mode draws it
          ...needs(
            'Phased',
            'phased genotypes',
            self.hasPhasedOrHaploid,
            loaded,
          ),
          helpText:
            'Phased mode splits each sample into multiple rows representing each haplotype, and the phasing of the variants is used to color the variant in the individual haplotype rows. For example, a diploid sample SAMPLE1 will generate two rows SAMPLE1 HP0 and SAMPLE1 HP1 and a variant 1|0 will draw a box in the top row but not the bottom row. A haploid sample keeps one row, labelled with its own name',
          checked: self.renderingMode === 'phased',
          type: 'radio',
          onClick: () => {
            self.setPhasedMode('phased')
          },
        },
      ],
    },
    // The cell fill and the sample metadata's row colour are independent
    // colour objects, so each is a block of its own.
    colorByMenuItem({
      blocks: [
        {
          header: 'Cells',
          rows: [
            {
              label: 'Genotype',
              helpText:
                'Default coloring: allele dosage in allele-count mode, haplotype/allele color in phased mode',
              type: 'radio',
              checked: self.colorEncoding === undefined,
              onClick: () => {
                self.setColor(colorForValue(self.colorSetting, undefined))
              },
            },
            {
              ...phaseSet,
              helpText:
                'Color every alt-carrying cell by the phase set (FORMAT PS) its call belongs to, so one phasing block reads as a single hue along a haplotype row; ref and no-call cells keep their normal coloring',
              type: 'radio',
              checked: self.colorField === PHASE_SET_FIELD,
              disabled: phaseSet.disabled || self.renderingMode !== 'phased',
              disabledHelpText: phaseSet.disabled
                ? undefined
                : 'Only applies in phased mode — switch Rendering mode to phased',
              onClick: () => {
                self.setColorField(PHASE_SET_FIELD)
              },
            },
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
                self.setColorField(IMPACT_FIELD)
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
                self.setColorField(SV_TYPE_FIELD)
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
                pickCellSolidColor(self)
              },
            ),
          ],
        },
        {
          header: 'Samples',
          rows:
            self.colorByAttributes.length || self.rowColorChoice
              ? rowColorItems(self)
              : [],
        },
      ],
      additional: [
        // Only in allele-count mode: a phased row is one haplotype, which either
        // carries the allele or does not, so the ramp has nothing to express.
        ...(self.renderingMode === 'phased'
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
    // The banding half of the same metadata, beside the coloring half: both
    // are config slots a session can set, and only the coloring one had a way
    // in from the menu.
    ...(self.colorByAttributes.length
      ? [
          {
            label: 'Group by...',
            icon: WorkspacesIcon,
            subMenu: sampleAttributeItems(
              self.colorByAttributes,
              self.facet?.field ?? '',
              arg => {
                self.setFacet(arg)
              },
            ),
          },
        ]
      : []),
    ...filterMenuItems({
      // Declared once (see `Reversible`), so the count in the label and what
      // "Clear all filters" clears come from the same list — they were two,
      // and a filter added to one and not the other is one the clear leaves on.
      //
      // Each counted by whether it is DOING anything, not by whether it was
      // edited: MAF is off at 0 and missingness at 1 (keep every variant).
      // Neither slider names its own undo row; each has its own reset inline
      // below, and the group clear is what resets the whole set.
      narrowings: {
        maf: {
          count: self.minorAlleleFrequencyFilter > 0 ? 1 : 0,
          clear: () => {
            self.setMafFilter(0)
          },
        },
        missingness: {
          count: self.maxMissingnessFilter < 1 ? 1 : 0,
          clear: () => {
            self.setMaxMissingnessFilter(1)
          },
        },
        filter: jexlFilterNarrowing(self),
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
      subItems: [
        // Both are bounded fractions tuned by feel, so they're inline sliders
        // rather than a dialog round-trip. They're fetch inputs (rpcProps), so
        // commitOnRelease keeps a drag from firing a worker refetch per step.
        makeSizeMenu({
          label: 'Minor allele frequency',
          title: 'MAF',
          min: 0,
          max: 0.5,
          step: 0.01,
          format: n => (n === 0 ? 'off' : n.toFixed(2)),
          commitOnRelease: true,
          getValue: () => self.minorAlleleFrequencyFilter,
          isDefault: self.minorAlleleFrequencyFilter === 0,
          onChange: n => {
            self.setMafFilter(n)
          },
          onReset: () => {
            self.setMafFilter(0)
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
          getValue: () => self.maxMissingnessFilter,
          isDefault: self.maxMissingnessFilter === 1,
          onChange: n => {
            self.setMaxMissingnessFilter(n)
          },
          onReset: () => {
            self.setMaxMissingnessFilter(1)
          },
        }),
      ],
    }),
    clusteringMenuItem(
      self,
      {
        label: 'Cluster rows by genotype...',
        // Off the sample list, not `loaded`: the samples arrive on their own RPC
        // (`MultiSampleVariantGetSources`), which neither waits for the cell data
        // nor is waited on by it. Keyed on the cell data, the row blamed the
        // cohort for a sample list that had not landed yet, and called a genuinely
        // single-sample track still-loading forever. Below that, the row count
        // is `clusteringMenuItem`'s gate.
        disabled: !self.adapterSamples,
        disabledHelpText: 'Loading samples...',
        onClick: () => {
          getDialogHost(self).queueDialog(handleClose => [
            ClusterDialog,
            {
              model: self,
              handleClose,
            },
          ])
        },
      },
      self.sources.length,
    ),
    rowArrangementMenuItem(self, {
      ready: self.clusteringReady && !!self.adapterSamples?.length,
    }),
    // Three things write this display's row order — a clustering run, the
    // arrangement dialog, and the right-click "Sort by genotype" below — and
    // until now the only way back from any of them was the dialog's own reset,
    // which is a strange place to look for the undo of a right-click.
    ...resetRowOrderMenuItems(self),
  ]
}

// Right-click context-menu items for the hovered/clicked variant feature.
export function variantContextMenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  const feat = self.contextMenuInfo?.feature
  return feat
    ? [
        {
          label: 'Open feature details',
          icon: MenuOpenIcon,
          onClick: () => {
            self.selectFeature(feat)
          },
        },
        // The multi-row painting's label for the same row
        {
          label: 'Copy location',
          icon: ContentCopyIcon,
          onClick: () => {
            const loc = assembleLocString({
              refName: feat.get('refName'),
              start: feat.get('start'),
              end: feat.get('end'),
            })
            // Only the VCF ID column; a feature with no ID ('.') copies as
            // bare location rather than feat.id(), an internal adapter string.
            const name = feat.get('name')
            void copyText(self, name ? `${name} ${loc}` : loc, 'variant')
          },
        },
        // The same row `LinearVariantDisplay` puts on a breakend, off the same
        // launcher. These displays hold the resolved record already, so they
        // reach it without that display's re-fetch — see
        // `breakendSplitViewMenuItem`. Placed above "Sort by genotype" because
        // it is about the record, as the two rows above it are, where the sort
        // is about the rows.
        ...breakendSplitViewMenuItem(self, feat),
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
      ]
    : []
}
