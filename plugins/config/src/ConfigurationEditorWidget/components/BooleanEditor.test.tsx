import { fireEvent, render } from '@testing-library/react'

import BooleanEditor from './BooleanEditor.tsx'

test('reflects a plain boolean slot and writes the flip', () => {
  const slot = {
    name: 'testBoolean',
    value: false,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  const box = getByRole('checkbox') as HTMLInputElement
  expect(box.checked).toBe(false)
  fireEvent.click(box)
  expect(slot.set).toHaveBeenCalledWith(true)
})

// An unset `maybeBoolean` is the promotable inherit sentinel, so what the track
// actually draws is `promotedBase`. Rendering it as unchecked showed the
// opposite of the truth on every slot whose base is `true`
// (displayDirectionalChevrons, showSashimiArcs, readConnectionsDown).
test('unset promotable slot shows promotedBase, not false', () => {
  const slot = {
    name: 'displayDirectionalChevrons',
    value: undefined,
    promotedBase: true,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
})

// The follow-on symptom: with the box shown unchecked, ticking it wrote `true`
// — the value the track already had — so nothing changed on screen while the
// slot quietly customized itself out of the cascade. Unticking is now the write
// that actually changes something.
test('clicking an unset base-true slot writes false', () => {
  const slot = {
    name: 'displayDirectionalChevrons',
    value: undefined,
    promotedBase: true,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  fireEvent.click(getByRole('checkbox'))
  expect(slot.set).toHaveBeenCalledWith(false)
})

test('unset promotable slot with a false base still shows unchecked', () => {
  const slot = {
    name: 'showSoftClipping',
    value: undefined,
    promotedBase: false,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
})

test('a customized value wins over promotedBase', () => {
  const slot = {
    name: 'displayDirectionalChevrons',
    value: false,
    promotedBase: true,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
})
