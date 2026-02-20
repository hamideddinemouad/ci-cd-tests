describe("About page", () => {
  it("renders the About heading and navigates home", () => {
    cy.visit("/about");

    cy.contains("h1", "About").should("be.visible");
    cy.contains("a", "Home").should("have.attr", "href", "/");

    cy.contains("a", "Home").click();
    cy.url().should("eq", `${Cypress.config("baseUrl")}/`);
  });
});
