import {
  createView,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
} from './util.tsx'

export async function testAlignmentModificationsDisplay({
  config,
  timeout = 50000,
}: {
  config: any
  timeout?: number
}) {
  await createView(config)

  const display = await findDisplayPainted('pileup-display', { timeout })
  expectCanvasMatch(findCanvasIn(display))
}
