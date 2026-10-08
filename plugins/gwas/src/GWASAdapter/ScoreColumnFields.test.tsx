import { render } from '@testing-library/react'

import ScoreColumnFields from './ScoreColumnFields.tsx'

function expressionField(scoreTransform: string) {
  const { queryByLabelText, unmount } = render(
    <ScoreColumnFields
      scoreColumn="p"
      setScoreColumn={() => {}}
      scoreTransform={scoreTransform}
      setScoreTransform={() => {}}
    />,
  )
  const field = queryByLabelText('Score transform expression')
  unmount()
  return field
}

test('the expression field stays while its text is cleared or loses the jexl: prefix', () => {
  expect(expressionField('jexl:score')).toBeTruthy()
  expect(expressionField('')).toBeTruthy()
  expect(expressionField('jex')).toBeTruthy()
})

test('a preset shows no expression field', () => {
  expect(expressionField('negLog10')).toBeNull()
})
