import { makeSizeMenu } from '@jbrowse/core/ui'
import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { assembleLocString, getDialogHost } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { colorForValue } from '@jbrowse/display-kit/colorConfigSchema'
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
import PaletteIcon from '@mui/icons-material/Palette'
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
  MultiSampleVariantClusterDialog as ClusterDialog,
  JexlFilterDialog,
  SetColorDialog,
} from './lazyDialogs.ts'
import { IMPACT_FIELD } from './variantConsequence.ts'
import { VARIANT_FILTER_EXAMPLES } from './variantFilterExamples.ts'
import { variantFilterFields } from './variantFilterFields.ts'
import { SV_TYPE_FIELD } from './variantSvType.ts'

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

// The rows' colour, as the arrangement dialog offers it: none, each row its
// own, or an attribute's values.
function rowColorItems(self: MultiSampleVariantBaseModel): MenuItem[] {
  const current = self.rowColorChoice
  const pick = (field: string) => () => {
    self.setRowColorField(field)
  }
  return [
    {
      label: 'None',
      type: 'radio',
      checked: current === '',
      onClick: pick(''),
    },
    {
      label: 'Each row',
      helpText: 'The colours set row by row in Edit colors/arrangement...',
      type: 'radio',
      checked: current === 'name',
      onClick: pick('name'),
    },
    ...self.colorByAttributes.map(attr => ({
      label: capitalizeFirst(attr),
      type: 'radio' as const,
      checked: current === attr,
      onClick: pick(attr),
    })),
  ]
}

// Items for the "Show..." submenu — the toggles both displays share. Extended
// by subclasses via super-capture (the regular display adds its variant lane
// rows); the subtree filter has its own entry via `clusteringMenuItem`.
export function variantShowSubmenuItems(
  self: MultiSampleVariantBaseModel,
): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    showRowSeparatorsMenuItem(self),
    legendCheckboxItem(self),
    ...(self.showsReferenceToggle
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
  const recordField = recordHueField(self.colorEncoding)?.field
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
          // Gated on `hasPhasedOrHaploid`, the predicate the painter itself uses
          // (`isPhasedOrHaploid`), not on a literal `|`. A pangenome callset is
          // haploid per assembly path and `vg deconstruct` writes bare
          // `0`/`1`/`23`, so `hasPhased` is false across a whole file that
          // phased mode renders correctly — one HP0 row per sample coloured by
          // allele identity — and `setPhasedMode` has no other caller, so the
          // config slot was the only door into a rendering this menu claimed did
          // not apply.
          label: `Phased${
            self.hasPhasedOrHaploid
              ? ''
              : !loaded
                ? ' (checking for phased variants...)'
                : ' (every genotype is unphased)'
          }`,
          helpText:
            'Phased mode splits each sample into multiple rows representing each haplotype, and the phasing of the variants is used to color the variant in the individual haplotype rows. For example, a diploid sample SAMPLE1 will generate two rows SAMPLE1 HP0 and SAMPLE1 HP1 and a variant 1|0 will draw a box in the top row but not the bottom row',
          disabled: !self.hasPhasedOrHaploid,
          // What is left when the gate is off is exactly "every called genotype
          // carries a `/`", so the message says that rather than the narrower
          // "no phased variants", which was wrong about a haploid file.
          disabledHelpText: !loaded
            ? 'Checking for phased variants...'
            : 'Every genotype in view is unphased (a / separator), so there is no haplotype to split a sample into',
          checked: self.renderingMode === 'phased',
          type: 'radio',
          onClick: () => {
            self.setPhasedMode('phased')
          },
        },
      ],
    },
    // One "Color by..." with the cell coloring and the (optional) sample
    // metadata coloring as subHeader-separated radio groups: they're
    // independent axes (cell fill vs. sidebar/sample palette) but both answer
    // "color by what", so they read better sectioned than as two sibling menus.
    {
      label: 'Color by...',
      icon: PaletteIcon,
      subMenu: [
        {
          label: 'Cells',
          type: 'subHeader',
        },
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
          label: `Phase set${
            self.hasPhaseSet
              ? ''
              : !loaded
                ? ' (checking for phase sets...)'
                : ' (no PS field found)'
          }`,
          helpText:
            'Color every alt-carrying cell by the phase set (FORMAT PS) its call belongs to, so one phasing block reads as a single hue along a haplotype row; ref and no-call cells keep their normal coloring',
          type: 'radio',
          checked: self.colorField === PHASE_SET_FIELD,
          disabled: !self.hasPhaseSet || self.renderingMode !== 'phased',
          disabledHelpText: !self.hasPhaseSet
            ? !loaded
              ? 'Checking for phase sets...'
              : 'No phase sets (FORMAT PS) found in this dataset'
            : 'Only applies in phased mode — switch Rendering mode to phased',
          onClick: () => {
            self.setColorField(PHASE_SET_FIELD)
          },
        },
        {
          label: `Consequence impact${
            self.hasConsequence
              ? ''
              : !loaded
                ? ' (checking for annotations...)'
                : ' (no SnpEff/VEP annotations found)'
          }`,
          helpText:
            'Color every alt-carrying cell by the variant’s most severe SnpEff (ANN) / VEP (CSQ) consequence impact tier; ref and no-call cells keep their normal coloring',
          type: 'radio',
          checked: self.colorField === IMPACT_FIELD,
          disabled: !self.hasConsequence,
          disabledHelpText: !loaded
            ? 'Checking for annotations...'
            : 'No SnpEff/VEP annotations (ANN/CSQ) found in this dataset',
          onClick: () => {
            self.setColorField(IMPACT_FIELD)
          },
        },
        {
          label: `SV type${
            self.hasSvType
              ? ''
              : !loaded
                ? ' (checking for structural variants...)'
                : ' (no structural variants found)'
          }`,
          helpText:
            'Color every alt-carrying cell by the variant’s structural-variant class (deletion, duplication, insertion, inversion, ...); ref and no-call cells keep their normal coloring',
          type: 'radio',
          checked: self.colorField === SV_TYPE_FIELD,
          disabled: !self.hasSvType,
          disabledHelpText: !loaded
            ? 'Checking for structural variants...'
            : 'No structural variants (SVTYPE) found in this dataset',
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
        // Only in allele-count mode: a phased row is one haplotype, which either
        // carries the allele or does not, so the ramp has nothing to express
        // there — and the setting is a fetch input, so the checkbox would have
        // refetched the same cells.
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
        ...(self.colorByAttributes.length
          ? [
              {
                label: 'Samples',
                type: 'subHeader' as const,
              },
              ...rowColorItems(self),
            ]
          : []),
      ],
    },
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
        jexlFilters: jexlFilterNarrowing(self),
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
    rowArrangementMenuItem({
      ready: !!self.adapterSamples?.length,
      onOpen: () => {
        getDialogHost(self).queueDialog(handleClose => [
          SetColorDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
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
        // The same label the multi-row painting's menu uses for the same
        // row, so the two displays don't offer one action under two names
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
