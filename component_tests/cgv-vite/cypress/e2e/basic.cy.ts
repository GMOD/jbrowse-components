describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord-adp-1843523680-A-0', { timeout: 30000 })
  })
})
