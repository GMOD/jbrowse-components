describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    // the resting chords are canvas pixels, so the renderer group's count is
    // what says the track drew
    cy.findByTestId('structuralVariantChordRenderer', { timeout: 30000 })
      .invoke('attr', 'data-chord-count')
      .then(count => {
        expect(Number(count)).to.be.greaterThan(0)
      })
  })
})
