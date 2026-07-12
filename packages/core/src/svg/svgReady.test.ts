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

test('a throwing svgReady getter rejects faithfully, not masked', async () => {
  const model = {
    get svgReady(): boolean {
      throw new Error('view.width read before init')
    },
  }
  await expect(awaitSvgReady(model)).rejects.toThrow(
    'view.width read before init',
  )
})
