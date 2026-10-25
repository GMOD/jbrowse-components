import {
  bootAlignmentsDisplay,
  clickMenuItem,
  menuSubItems,
} from '../testUtils.ts'
import {
  COMPACTNESS_PRESETS,
  FIT_TO_TRACK_LABEL,
  NORMAL_PITCH,
  featureSpacingForHeight,
  getFeatureHeightMenuItem,
  getTrackSizingItems,
} from './featureSize.ts'

import type { MenuItem } from '@jbrowse/core/ui'

test('featureSpacingForHeight: 1px gap only once the body clears 3px', () => {
  expect(featureSpacingForHeight(1)).toBe(0)
  expect(featureSpacingForHeight(3)).toBe(0)
  expect(featureSpacingForHeight(3.5)).toBe(1)
  expect(featureSpacingForHeight(7)).toBe(1)
})

test('featureSpacingForHeight reproduces the fixed-mode preset pitches', () => {
  const pitch = (h: number) => h + featureSpacingForHeight(h)
  expect(pitch(COMPACTNESS_PRESETS.normal.height)).toBe(8)
  expect(pitch(COMPACTNESS_PRESETS.compact.height)).toBe(3)
  expect(pitch(COMPACTNESS_PRESETS['super-compact'].height)).toBe(1)
})

test('NORMAL_PITCH is the Normal body plus its derived gap (the fit cap)', () => {
  const { height: featureHeight } = COMPACTNESS_PRESETS.normal
  expect(NORMAL_PITCH).toBe(
    featureHeight + featureSpacingForHeight(featureHeight),
  )
  expect(NORMAL_PITCH).toBe(8)
})

// The props of every dialog the display has queued. `rpcManager` is what makes
// the session answer `isSessionServices`, which is how `getDialogHost` finds it
// — nothing here issues an RPC.
function createDisplay() {
  const { baseSession, mount } = bootAlignmentsDisplay()
  const queuedDialogProps: Record<string, unknown>[] = []
  const Session = baseSession
    .volatile(() => ({ rpcManager: {} }))
    .actions(() => ({
      queueDialog(
        callback: (done: () => void) => [unknown, Record<string, unknown>],
      ) {
        queuedDialogProps.push(callback(() => {})[1])
      },
    }))
  return { display: mount(Session).display, queuedDialogProps }
}

// LGVSyntenyDisplay reuses this menu with its own noun, so the dialog the Custom
// row opens has to be handed it too — it titled itself "Custom read height" over
// a display that draws synteny features.
test('the Custom row hands the dialog the display noun', () => {
  const { display, queuedDialogProps } = createDisplay()
  const { subMenu, label } = getFeatureHeightMenuItem(display, 'feature')
  expect(label).toBe('Feature height')
  clickMenuItem(subMenu, 'Custom...')
  expect(queuedDialogProps[0]).toMatchObject({
    title: 'Custom feature height',
    label: 'Feature height (px)',
  })
})

function checkedLabels(items: MenuItem[]) {
  return items.flatMap(i =>
    'checked' in i && i.checked && 'label' in i ? [i.label] : [],
  )
}

// Fit derives the size, so it is the fifth choice of one radio group rather
// than a mode in a second group beside the sizes.
test('fit to track height is one more read height radio', () => {
  const { display } = createDisplay()
  const rows = () => getFeatureHeightMenuItem(display, 'read').subMenu
  expect(rows()).toHaveLength(5)
  clickMenuItem(rows(), FIT_TO_TRACK_LABEL)
  expect(display.heightMode).toBe('fit')
  expect(checkedLabels(rows())).toEqual([FIT_TO_TRACK_LABEL])
  clickMenuItem(rows(), COMPACTNESS_PRESETS.compact.label)
  expect(display.heightMode).toBe('fixed')
  expect(checkedLabels(rows())).toEqual([COMPACTNESS_PRESETS.compact.label])
})

test('Track height picks the height mode, and the row cap needs rows', () => {
  const { display } = createDisplay()
  const rows = (gate = {}) => getTrackSizingItems(display, gate)
  const modes = () => menuSubItems(rows(), 'Track height')
  clickMenuItem(modes(), 'Autogrow')
  expect(display.heightMode).toBe('grow')
  expect(checkedLabels(modes())).toEqual(['Autogrow'])
  clickMenuItem(modes(), FIT_TO_TRACK_LABEL)
  expect(display.heightMode).toBe('fit')
  clickMenuItem(modes(), 'Fixed')
  expect(display.heightMode).toBe('fixed')
  expect(rows().map(i => 'label' in i && i.label)).toEqual([
    'Track height',
    'Set max layout height...',
  ])
  expect(
    rows({ disabled: true, disabledHelpText: 'no pileup' }).map(
      i => 'label' in i && i.label,
    ),
  ).toEqual(['Track height'])
})
