import { elideSignature, previewType, tidyType } from './typeText.ts'

describe('elideSignature', () => {
  test('drops whole alternatives, never splitting on a pipe inside a literal', () => {
    const first = `"${'x'.repeat(100)}|${'y'.repeat(100)}"`
    expect(elideSignature(`${first} | "z"`, 180)).toBe(`${first} | …`)
  })
})

describe('tidyType', () => {
  test('drops the undefined an optional parameter already says', () => {
    expect(tidyType('(opts?: Options | undefined) => void')).toBe(
      '(opts?: Options) => void',
    )
  })

  test('drops it from an optional member, unwrapping what it grouped', () => {
    expect(tidyType('{ onClick?: (() => void) | undefined; }')).toBe(
      '{ onClick?: () => void; }',
    )
  })

  test('keeps an undefined a function type returns', () => {
    expect(tidyType('(cb?: () => string | undefined) => void')).toBe(
      '(cb?: () => string | undefined) => void',
    )
  })

  test('keeps an undefined a required parameter takes', () => {
    expect(tidyType('(a: string | undefined, b?: number) => void')).toBe(
      '(a: string | undefined, b?: number) => void',
    )
  })

  test('reads NoInfer<T> as T', () => {
    expect(
      tidyType('<N extends string>(initialState?: NoInfer<Snapshot<N>>) => N'),
    ).toBe('<N extends string>(initialState?: Snapshot<N>) => N')
  })

  test('names an awaited ReactNode', () => {
    expect(
      tidyType(
        '() => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | AwaitedReactNode>',
      ),
    ).toBe('() => Promise<ReactNode>')
  })
})

describe('previewType', () => {
  test('leaves code that fits alone', () => {
    expect(previewType('(x: number) => boolean', 64)).toBe(
      '(x: number) => boolean',
    )
  })

  test("keeps an object's leading members", () => {
    expect(
      previewType(
        'readonly { key: string; x: number; width: number; kind: "boundary" | "gap"; }[]',
        64,
      ),
    ).toBe('readonly { key: string; x: number; width: number; … }[]')
  })

  test("falls back to a function's parameter names", () => {
    expect(
      previewType(
        '(coord: number, refName: string, displayedRegionIndex?: number, toCenter?: boolean) => void',
        64,
      ),
    ).toBe('(coord, refName, displayedRegionIndex?, toCenter?) => void')
  })

  test('drops trailing parameter names before cutting', () => {
    expect(
      previewType(
        '(trackId: string, initialSnapshot?: object, displayInitialSnapshot?: DisplayInitialSnapshot, inlineConf?: Record<string, unknown>) => any',
        64,
      ),
    ).toBe('(trackId, initialSnapshot?, displayInitialSnapshot?, …) => any')
  })

  test('cuts between tokens, never inside a name', () => {
    expect(
      previewType(
        'someFunctionName(argumentNumberOne, argumentNumberTwo, argumentNumberThree)',
        64,
      ),
    ).toBe('someFunctionName(argumentNumberOne, argumentNumberTwo,…')
  })
})
