import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import ShuffleIcon from '@mui/icons-material/Shuffle'

import {
  DEFAULT_MIN_ALIGNMENT_LENGTH,
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
} from './minLengthHelp.ts'

import type { SyntenyColorSurface } from './colorModes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * #api
 * The Opacity row of a view with `SyntenyViewMixin`, reset to that view's
 * default. Under a field it moves the field's most opaque end.
 */
export function opacityMenuItem(model: {
  opacityLevel: number
  defaultOpacity: number
  setOpacity: (value: number) => void
  colorSurface: () => SyntenyColorSurface
}): MenuItem {
  return makeSizeSubMenu({
    label: 'opacity',
    title: 'Opacity',
    help: `Lower lets overlapping ${model.colorSurface()} show through each other.`,
    min: 0,
    max: 1,
    step: 0.01,
    // fine control near 0, where a small change is perceptually large
    scale: 'cubic',
    format: n => n.toFixed(3),
    getValue: () => model.opacityLevel,
    isDefault: model.opacityLevel === model.defaultOpacity,
    onChange: value => {
      model.setOpacity(value)
    },
    onReset: () => {
      model.setOpacity(model.defaultOpacity)
    },
  })
}

/**
 * #api
 * The Identity fade toggle of a view with `SyntenyViewMixin`: `opacity`
 * read from `identity`, or back to the constant.
 */
export function identityFadeMenuItem(model: {
  opacityField: string | undefined
  setOpacityField: (field: string | undefined) => void
}): MenuItem {
  return toggleItem(
    'Identity fade',
    model.opacityField === 'identity',
    v => {
      model.setOpacityField(v ? 'identity' : undefined)
    },
    {
      helpText:
        'Fade each ribbon by its sequence identity, whatever the color mode.',
    },
  )
}

/**
 * #api
 * The Re-order chromosomes row every comparative view offers; `open` queues
 * that view's own dialog.
 */
export function reorderChromosomesMenuItem(open: () => void): MenuItem {
  return {
    label: 'Re-order chromosomes...',
    icon: ShuffleIcon,
    onClick: open,
    helpText:
      'Reorders and reorients chromosomes so the alignments fall along the diagonal, making rearrangements, inversions and translocations stand out.',
  }
}

/** What the filter rows read and write: the view's `filter`. */
interface FilterRowModel {
  lowerBound: (field: string) => number
  setLowerBound: (field: string, value: number) => void
}

/**
 * #api
 * The Min length row of a view with `SyntenyFilterMixin`: the `filter`'s
 * lower bound on `length`.
 */
export function minLengthMenuItem(model: FilterRowModel): MenuItem {
  const bp = model.lowerBound('length')
  return makeSizeSubMenu({
    label: 'min length',
    title: 'Min length',
    help: MIN_LENGTH_HELP,
    min: DEFAULT_MIN_ALIGNMENT_LENGTH,
    max: MAX_MIN_LENGTH_BP,
    step: 1,
    scale: 'log',
    format: n => `${toLocale(n)}bp`,
    commitOnRelease: true,
    getValue: () => bp,
    isDefault: bp === DEFAULT_MIN_ALIGNMENT_LENGTH,
    onChange: value => {
      model.setLowerBound('length', value)
    },
    onReset: () => {
      model.setLowerBound('length', DEFAULT_MIN_ALIGNMENT_LENGTH)
    },
  })
}

/**
 * #api
 * The Min identity row of a view with `SyntenyFilterMixin`: the `filter`'s
 * lower bound on `identity`. A filter on identity drops an alignment that
 * reports none, so the row is disabled while no loaded alignment reports one.
 */
export function minIdentityMenuItem(
  model: FilterRowModel & { attributeRanges: Record<string, unknown> },
): MenuItem {
  const fraction = model.lowerBound('identity')
  const reported = 'identity' in model.attributeRanges
  return {
    ...makeSizeSubMenu({
      label: 'min identity',
      title: 'Min identity',
      help: 'Hide alignments below this sequence identity, and those that report none.',
      min: 0,
      max: 1,
      step: 0.01,
      format: n => `${(n * 100).toFixed(0)}%`,
      commitOnRelease: true,
      getValue: () => fraction,
      isDefault: fraction === 0,
      onChange: value => {
        model.setLowerBound('identity', value)
      },
      onReset: () => {
        model.setLowerBound('identity', 0)
      },
    }),
    disabled: !reported && fraction === 0,
    disabledHelpText: 'No alignment in these tracks reports an identity.',
  }
}
