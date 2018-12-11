import RecordingCanvas from './recordingCanvas'

test('can record commands and replay them', () => {
  const canvas = new RecordingCanvas(640, 480)
  expect(canvas.width).toBe(640)
  expect(canvas.height).toBe(480)

  const ctx = canvas.getContext('2d')
  const ctx2 = canvas.getContext('2d')
  expect(ctx).toBeTruthy()
  ctx.fillStyle = 'red'
  ctx2.fillStyle = 'blue'
  expect(canvas.exportState()).toMatchSnapshot()
})
