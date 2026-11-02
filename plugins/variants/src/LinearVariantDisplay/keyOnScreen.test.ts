import { autorun } from 'mobx'

import {
  cellDataOf,
  cellPayloadOf,
  featureInfoOf,
} from '../shared/cellDataFixtures.ts'
import { CELL_ALT, CELL_NO_CALL } from '../shared/variantCellStyles.ts'
import { createTestEnvironment } from './testEnv.ts'

// The view shows ctgA:0-800. One variant there paints an alt cell; one in the
// fetch buffer at 5000 also paints a no-call.
function setup() {
  const { display } = createTestEnvironment().createDisplay()
  display.setCellData(
    cellDataOf({
      perRegionCellData: {
        0: cellPayloadOf(
          [featureInfoOf('onScreen'), featureInfoOf('buffered')],
          {
            featurePositions: Uint32Array.from([100, 101, 5000, 5001]),
            featureCategories: Uint8Array.from([
              1 << CELL_ALT,
              (1 << CELL_ALT) | (1 << CELL_NO_CALL),
            ]),
          },
        ),
      },
    }),
  )
  const dispose = autorun(() => {
    void display.hasNoCall
  })
  return { display, dispose }
}

test('the key leaves out a no-call painted only in the fetch buffer', () => {
  const { display, dispose } = setup()
  expect(display.keyWindows).toEqual([
    { regionIndex: 0, refName: 'ctgA', start: 0, end: 800 },
  ])
  expect(display.hasNoCall).toBe(false)
  dispose()
})

test('the key lists the no-call once the view settles over it', () => {
  const { display, dispose } = setup()
  display.view.setNewView(1, 4900)
  expect(display.hasNoCall).toBe(true)
  dispose()
})
