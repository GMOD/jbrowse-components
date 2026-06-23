describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('structuralVariantChordRenderer', { timeout: 30000 })
      .find('path')
      .should('have.length.greaterThan', 0)
  })
})
