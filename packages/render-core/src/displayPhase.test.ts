import { computeDisplayPhase } from './displayPhase.ts'

const NONE = { renderError: undefined, regionTooLarge: false, error: undefined }
const never = () => {
  throw new Error('loading thunk should not be evaluated')
}

describe('computeDisplayPhase precedence', () => {
  test('renderError wins over everything', () => {
    expect(
      computeDisplayPhase(
        { renderError: new Error('x'), regionTooLarge: true, error: 'y' },
        never,
      ),
    ).toBe('renderError')
  })

  test('tooLarge wins over error and loading', () => {
    expect(
      computeDisplayPhase(
        { renderError: undefined, regionTooLarge: true, error: 'y' },
        never,
      ),
    ).toBe('tooLarge')
  })

  test('error wins over loading', () => {
    expect(
      computeDisplayPhase(
        { renderError: undefined, regionTooLarge: false, error: 'y' },
        never,
      ),
    ).toBe('error')
  })

  test('loading when the loading thunk is true', () => {
    expect(computeDisplayPhase(NONE, () => true)).toBe('loading')
  })

  test('ready when nothing terminal and not loading', () => {
    expect(computeDisplayPhase(NONE, () => false)).toBe('ready')
  })
})

describe('computeDisplayPhase lazy loading evaluation', () => {
  // Load-bearing: the loading condition reads the containing view's reactive
  // state, so it must NOT be evaluated while a terminal flag is set — otherwise
  // a MobX observer reading displayPhase over-subscribes during a terminal
  // state and the banner subtree fails to commit (see DisplayChrome.tsx).
  test.each([
    ['renderError', { ...NONE, renderError: new Error('x') }],
    ['tooLarge', { ...NONE, regionTooLarge: true }],
    ['error', { ...NONE, error: 'boom' }],
  ])('does not call loading thunk when %s is set', (_label, inputs) => {
    const loading = jest.fn(() => true)
    computeDisplayPhase(inputs, loading)
    expect(loading).not.toHaveBeenCalled()
  })

  test('calls loading thunk only once when no terminal flag is set', () => {
    const loading = jest.fn(() => false)
    computeDisplayPhase(NONE, loading)
    expect(loading).toHaveBeenCalledTimes(1)
  })
})
