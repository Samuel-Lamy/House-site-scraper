const puppeteer = require("puppeteer");
const fs = require("fs");

const scrapeWebsite = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134"
  );

  await page.goto(
    "https://www.centris.ca/fr/propriete~a-vendre~trois-rivieres"
  );

  await page.waitForSelector("#property-result");
  await page.screenshot({ path: "screenshot.png" });

  const data = await page.evaluate(() => {
    const title = document.title;
    const text = document.querySelector("div").innerText;

    return {
      title,
      text,
    };
  });

  await browser.close();
  return data;
};

scrapeWebsite()
  .then((result) => {
    const dataString = JSON.stringify(result, null, 2);
    fs.writeFileSync("Data/scrapedData.txt", dataString, "utf-8");
  })
  .catch((error) => {
    console.error(error);
  });
