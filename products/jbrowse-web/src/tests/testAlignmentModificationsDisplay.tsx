import { createView, expectCanvasMatch, findCanvasIn } from './util.tsx'

export async function testAlignmentModificationsDisplay({
  config,
  timeout = 50000,
}: {
  config: any
  canvasTestId?: string | RegExp
  timeout?: number
}) {
  const opts = [{}, { timeout }] as const
  const { findByTestId } = await createView(config)

  const display = await findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display))
}
