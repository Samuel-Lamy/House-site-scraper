import { JSDOM } from "jsdom";

export const createFrontend = async () => {
  return await fetch(
    "https://www.centris.ca/fr/propriete~a-vendre~trois-rivieres"
  )
    .then((response) => response.text())
    .then((html) => {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const propertiesToDelete = document.querySelectorAll(
        ".property-thumbnail-item"
      );
      propertiesToDelete.forEach((property) => property.remove());
      return dom.serialize();
    })
    .catch((error) => {
      console.error("Error fetching or modifying webpage:", error);
    });
};
