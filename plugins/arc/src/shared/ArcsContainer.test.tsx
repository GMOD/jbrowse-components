import { render } from '@testing-library/react'

import ArcsContainer from './ArcsContainer.tsx'
import { createTestEnvironment } from './testEnv.ts'

const { createDisplay } = createTestEnvironment()

// The one fact this component exists to own, and the reason it is shared rather
// than written once per arc display: whether the arcs need an `<svg>` around
// them depends on which path is drawing, and the two displays were each
// answering it for themselves. The export snapshot in
// products/jbrowse-web/src/tests/ExportSvgDisplayTypes.test.tsx covers the
// export half end-to-end; nothing covered the on-screen half.
test('on screen the arcs get their own <svg>', () => {
  const { display } = createDisplay()
  const { container } = render(
    <ArcsContainer model={display}>
      {() => <path d="M 0 0 L 1 1" />}
    </ArcsContainer>,
  )
  expect(container.querySelector('svg')).not.toBeNull()
})

// `renderArcSvg` has already opened one (SvgChrome → SvgClipRect), so a second
// would nest and clip the arcs to a box inside the box they were laid out in.
test('on the export path they do not, since renderArcSvg opened one', () => {
  const { display } = createDisplay()
  const { container } = render(
    <ArcsContainer model={display} exportSVG>
      {() => <path d="M 0 0 L 1 1" />}
    </ArcsContainer>,
  )
  expect(container.querySelector('svg')).toBeNull()
  expect(container.querySelector('path')).not.toBeNull()
})
