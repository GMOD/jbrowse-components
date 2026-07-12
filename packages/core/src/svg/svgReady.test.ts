import { observable, runInAction } from 'mobx'

import { awaitSvgReady } from './svgReady.ts'

test('resolves once svgReady flips true', async () => {
  const model = observable({ svgReady: false })
  const p = awaitSvgReady(model)
  runInAction(() => {
    model.svgReady = true
  })
  await expect(p).resolves.toBeUndefined()
})

test('timeout produces the diagnostic message', async () => {
  const model = observable({ svgReady: false })
  await expect(awaitSvgReady(model, 10)).rejects.toThrow(/timed out after 10ms/)
})

test('rethrows a throwing svgReady getter instead of mislabeling it a timeout', async () => {
  const model = {
    get svgReady(): boolean {
      throw new Error('view.width read before init')
    },
  }
  await expect(awaitSvgReady(model, 5000)).rejects.toThrow(
    'view.width read before init',
  )
})
