import { sessionOverflowInPage } from './sessionOverflow.ts'

// jsdom lays nothing out, so the heights a real layout would compute are set by
// hand on the elements the function measures.
function stage({
  scrollHeight,
  clientHeight,
  overscroll,
}: {
  scrollHeight: number
  clientHeight: number
  overscroll?: number
}) {
  document.body.innerHTML = `
    <div id="app">
      <div id="column" style="overflow-y: auto">
        <div><div data-testid="view-container-abc"></div></div>
        ${overscroll === undefined ? '' : '<div data-testid="view-stack-overscroll"></div>'}
      </div>
    </div>`
  const column = document.getElementById('column')!
  Object.defineProperties(column, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: clientHeight },
  })
  const spacer = document.querySelector('[data-testid="view-stack-overscroll"]')
  if (spacer && overscroll !== undefined) {
    spacer.getBoundingClientRect = () => ({ height: overscroll }) as DOMRect
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

// The document is the window's height whatever the session holds, which is why
// measuring it made --fullPage a silent no-op.
test('the overflow is the scrolling column, not the document', () => {
  stage({ scrollHeight: 1200, clientHeight: 400 })
  expect(sessionOverflowInPage()).toBe(800)
})

test('the trailing overscroll is room, not content', () => {
  stage({ scrollHeight: 1500, clientHeight: 400, overscroll: 300 })
  expect(sessionOverflowInPage()).toBe(800)
})

test('a session that fits has no overflow', () => {
  stage({ scrollHeight: 400, clientHeight: 400 })
  expect(sessionOverflowInPage()).toBe(0)
})
