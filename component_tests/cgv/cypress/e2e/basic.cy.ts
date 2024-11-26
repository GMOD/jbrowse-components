describe('JBrowse embedded circular view', () => {
  it('track loads', () => {
    cy.visit('/')

    cy.findByTestId('chord-1148282975-vcf-63189', { timeout: 30000 })
  })
})
