import { bootAlignmentsDisplay, clickMenuItem } from '../testUtils.ts'
import {
  COMPACTNESS_PRESETS,
  NORMAL_PITCH,
  featureSpacingForHeight,
  getFeatureHeightMenuItem,
} from './featureSize.ts'

test('featureSpacingForHeight: 1px gap only once the body clears 3px', () => {
  expect(featureSpacingForHeight(1)).toBe(0)
  expect(featureSpacingForHeight(3)).toBe(0)
  expect(featureSpacingForHeight(3.5)).toBe(1)
  expect(featureSpacingForHeight(7)).toBe(1)
})

test('featureSpacingForHeight reproduces the fixed-mode preset pitches', () => {
  const pitch = (h: number) => h + featureSpacingForHeight(h)
  expect(pitch(COMPACTNESS_PRESETS.normal.featureHeight)).toBe(8)
  expect(pitch(COMPACTNESS_PRESETS.compact.featureHeight)).toBe(3)
  expect(pitch(COMPACTNESS_PRESETS['super-compact'].featureHeight)).toBe(1)
})

test('NORMAL_PITCH is the Normal body plus its derived gap (the fit cap)', () => {
  const { featureHeight } = COMPACTNESS_PRESETS.normal
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
  expect(queuedDialogProps[0]).toMatchObject({ noun: 'feature' })
})
