import { createView, expectAlignmentCanvasMatch } from './util'

export async function testAlignmentModificationsDisplay({
  config,
  canvasTestId,
  timeout = 50000,
}: {
  config: any
  canvasTestId: string
  timeout?: number
}) {
  await createView(config)

  await expectAlignmentCanvasMatch(
    [
      { blockset: 'pileup', canvasId: canvasTestId },
      { blockset: 'snpcoverage', canvasId: canvasTestId },
    ],
    timeout,
  )
}
