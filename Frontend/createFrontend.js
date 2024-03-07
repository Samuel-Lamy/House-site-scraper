export const createFrontend = async () => {
  return await fetch(
    "https://www.centris.ca/fr/propriete~a-vendre~trois-rivieres"
  )
    .then((response) => response.text())
    .then((html) => {
      return html;
    })
    .catch((error) => {
      console.error("Error fetching or modifying webpage:", error);
    });
};
