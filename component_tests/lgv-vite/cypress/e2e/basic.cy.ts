describe('JBrowse embedded view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('pileup-display-done', { timeout: 30000 })
  })
})
