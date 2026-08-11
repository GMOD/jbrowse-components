describe('JBrowse embedded view', () => {
  it('track loads', () => {
    cy.visit('/')

    // ADR-065: the testid names the display type and no longer gains a `-done`
    // suffix when the canvas finishes — readiness is the `data-display-drawn`
    // attribute the chrome publishes beside it. `findByTestId` can only match
    // the testid, so this waits on both as one attribute selector.
    cy.get('[data-testid="pileup-display"][data-display-drawn="true"]', {
      timeout: 30000,
    })
  })
})
