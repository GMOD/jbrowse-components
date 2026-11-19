import { resolveSubMenu } from '@jbrowse/core/ui'

import { createTestEnvironment } from './testEnv.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicDataResult,
  RenderHicDataArgs,
} from '../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A file with no expected values and no VC at this binsize. Between a click and
// the fetch it starts, the open menu still ticks what is on screen, and it
// must not yet say the file lacks what was just picked.

function result(args: RenderHicDataArgs): HicDataResult {
  return {
    instances: new Float32Array(0),
    numContacts: 0,
    minScore: 0,
    maxScore: 0,
    quantileScore: 0,
    quantile: args.quantile,
    binWidth: args.binSize / Math.SQRT2,
    originBp: args.originBp,
    binSize: args.binSize,
    appliedNormalizations: ['KR'],
    appliedField: 'observed',
    regions: [],
    pairRuns: [],
  }
}

function setup() {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  const pending: (() => void)[] = []
  mockRpcCall.mockImplementation((_sid: string, method: string, args: never) =>
    method === 'CoreGetInfo'
      ? Promise.resolve({ norms: ['KR', 'VC'], resolutions: [500, 1000, 5000] })
      : new Promise(resolve => {
          pending.push(() => {
            resolve(result(args))
          })
        }),
  )
  const { display } = createDisplay()
  return { display, pending }
}

async function flush() {
  await jest.advanceTimersByTimeAsync(1100)
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function labelOf(item: MenuItem) {
  return 'label' in item ? item.label : undefined
}

function helpOf(display: LinearHicDisplayModel, menu: string, row: string) {
  const item = buildHicTrackMenuItems(display).find(i => labelOf(i) === menu)
  const found = (item && 'subMenu' in item ? resolveSubMenu(item) : []).find(
    i => labelOf(i) === row,
  )
  return found && 'helpText' in found ? found.helpText : undefined
}

test('a field the file lacks is named once its fetch lands, not while the last one shows', async () => {
  const { display, pending } = setup()
  await flush()
  pending.shift()!()
  await flush()
  expect(display.dataCurrent).toBe(true)

  display.colorByField('observed/expected')
  expect(helpOf(display, 'Values', 'Observed/expected')).not.toMatch(
    /no expected values/,
  )

  await flush()
  pending.shift()!()
  await flush()
  expect(helpOf(display, 'Values', 'Observed/expected')).toMatch(
    /no expected values/,
  )
})

test('a normalization the file lacks is named once its fetch lands, not while the last one shows', async () => {
  const { display, pending } = setup()
  await flush()
  pending.shift()!()
  await flush()

  display.setNormalization('VC')
  expect(helpOf(display, 'Normalization', 'VC')).not.toMatch(/Not available/)

  await flush()
  pending.shift()!()
  await flush()
  expect(helpOf(display, 'Normalization', 'VC')).toMatch(/Not available/)
})
