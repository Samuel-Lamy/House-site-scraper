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

  await page.waitForSelector("#didomi-notice-agree-button");
  await page.click("#didomi-notice-agree-button");

  await page.waitForSelector("#filter-search");
  await page.click("#filter-search");

  await page.waitForSelector("#PriceSection-secondary");
  await page.screenshot({ path: "screenshot.png" });
  const priceSection = await page.$("#PriceSection-heading-filters");
  await priceSection.click("button");

  await page.waitForSelector("#PriceSection-secondary");
  const priceSectionSecondary = await page.$("#PriceSection-secondary");
  await page.waitForSelector(".min-slider-handle");
  const minSlider = await priceSectionSecondary.$(".min-slider-handle");
  const maxSlider = await priceSectionSecondary.$(".max-slider-handle");
  const posMinSlider = await minSlider.asElement().boundingBox();
  const posMaxSlider = await maxSlider.asElement().boundingBox();
  const percentageLowestBoundPrice = 0.21;
  await page.mouse.click(
    posMinSlider.x +
      percentageLowestBoundPrice * (posMaxSlider.x - posMinSlider.x),
    posMinSlider.y
  );
  let percentageHighestBoundPrice = 1;
  const WantedPercentageHighestBoundPrice = 0.37;
  while (percentageHighestBoundPrice !== WantedPercentageHighestBoundPrice) {
    const nextHalf =
      (percentageHighestBoundPrice - percentageLowestBoundPrice) / 2 +
      percentageLowestBoundPrice +
      0.02;
    if (nextHalf < WantedPercentageHighestBoundPrice) {
      percentageHighestBoundPrice = WantedPercentageHighestBoundPrice;
    } else {
      percentageHighestBoundPrice = nextHalf;
    }
    await page.mouse.click(
      posMinSlider.x +
        percentageHighestBoundPrice * (posMaxSlider.x - posMinSlider.x),
      posMinSlider.y
    );
  }

  await page.waitForSelector(".js-trigger-search");
  await page.click(".js-trigger-search");
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
