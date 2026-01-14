import { within } from '@testing-library/react'

import { createView, expectCanvasMatch } from './util.tsx'

export async function testAlignmentModificationsDisplay({
  config,
  canvasTestId,
  timeout = 50000,
}: {
  config: any
  canvasTestId: string | RegExp
  timeout?: number
}) {
  const opts = [{}, { timeout }] as const
  const { findByTestId } = await createView(config)

  const f1 = within(await findByTestId('Blockset-pileup'))
  const f2 = within(await findByTestId('Blockset-snpcoverage'))

  expectCanvasMatch(await f1.findByTestId(canvasTestId, ...opts))
  expectCanvasMatch(await f2.findByTestId(canvasTestId, ...opts))
}
