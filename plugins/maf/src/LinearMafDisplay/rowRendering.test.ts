import { createMafTestEnvironment } from './testEnv.ts'

// The rows can be colored exactly one way — `activeRowRendering` paints one and
// resolves a clash by precedence — but the three settings behind that choice are
// independent config slots, and the menu used to offer them as independent
// controls. Picking through `setRowRendering` is what makes the tick the truth.
describe('row coloring is one choice across three slots', () => {
  it('defaults to the bases', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.selectedRowRendering).toBe('bases')
  })

  it('selecting source chromosome clears an identity plot', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('heatmap')
    expect(display.selectedRowRendering).toBe('heatmap')
    expect(display.rowIdentityMode).toBe('heatmap')

    display.setRowRendering('sourceChrom')
    expect(display.selectedRowRendering).toBe('sourceChrom')
    expect(display.colorByChromosome).toBe(true)
    // the losing setting is turned off, not left on and outvoted
    expect(display.rowIdentityMode).toBe('none')
  })

  it('selecting an identity plot clears source chromosome', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('sourceChrom')
    display.setRowRendering('xyplot')
    expect(display.selectedRowRendering).toBe('xyplot')
    expect(display.colorByChromosome).toBe(false)
    expect(display.rowIdentityMode).toBe('xyplot')
  })

  it('selecting the bases clears everything else', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('sourceChrom')
    display.setRowRendering('bases')
    expect(display.selectedRowRendering).toBe('bases')
    expect(display.colorByChromosome).toBe(false)
    expect(display.rowIdentityMode).toBe('none')
    expect(display.showTranslation).toBe(false)
  })

  // The state the old menu could produce, and a saved session or hand-written
  // config still can: two of the three slots on at once. Nothing migrates it —
  // the getter reports the one that actually paints, and the next pick through
  // the radio clears the rest. Set here through the individual slot actions,
  // which is exactly the path that used to strand a setting.
  it('reports the winner when two slots are on, and the next pick clears it', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowIdentityMode('heatmap')
    display.setColorByChromosome(true)

    // both on; source chromosome outranks the identity plot
    expect(display.selectedRowRendering).toBe('sourceChrom')
    expect(display.activeRowRendering).toBe('sourceChrom')

    display.setRowRendering('heatmap')
    expect(display.colorByChromosome).toBe(false)
    expect(display.selectedRowRendering).toBe('heatmap')
  })

  // Codons need a reading frame, so the option is not offered — and not
  // reachable — without a `mafFrames` adapter. This track has none.
  it('does not select codon view without a frames adapter', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('codon')
    expect(display.annotationAdapterConfig).toBeUndefined()
    expect(display.selectedRowRendering).toBe('bases')
  })
})
