import { tutorialOpeningProblems } from './tutorial-openings.ts'

const page = (opening: string, ...sections: string[]) =>
  ['---', 'title: T', '---', '', opening, '', ...sections].join('\n')

const list = (n: number) =>
  Array.from({ length: n }, (_, i) => `- step ${i}`).join('\n')

test('a lead-in ending in a colon and three bullets pass', () => {
  expect(
    tutorialOpeningProblems(
      page(`We read a locus. We:\n\n${list(3)}`, '## Prerequisites\n\n- tool'),
    ),
  ).toEqual([])
})

test('bullets in a section below the opening do not count', () => {
  expect(
    tutorialOpeningProblems(
      page('We read a locus.', `## Prerequisites\n\n${list(4)}`),
    ),
  ).toEqual([expect.stringContaining('0 bullets')])
})

test('two bullets and six bullets fail', () => {
  expect(tutorialOpeningProblems(page(`We:\n\n${list(2)}`))).toEqual([
    expect.stringContaining('2 bullets'),
  ])
  expect(tutorialOpeningProblems(page(`We:\n\n${list(6)}`))).toEqual([
    expect.stringContaining('6 bullets'),
  ])
})

test('a caution block after the list does not hide it', () => {
  expect(
    tutorialOpeningProblems(
      page(`We:\n\n${list(3)}\n\n:::caution Experimental\n\n- aside\n\n:::`),
    ),
  ).toEqual([])
})

test('a lead-in that does not end in a colon fails', () => {
  expect(tutorialOpeningProblems(page(`We read it.\n\n${list(3)}`))).toEqual([
    expect.stringContaining('colon'),
  ])
})
