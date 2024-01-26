const puppeteer = require("puppeteer");
const fs = require("fs");

const cleanAddress = (address) => {
  const cleanedAddress = address
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/g, "_");
  return cleanedAddress;
};

const scrapeSingleHouse = async (houseElement) => {
  const address = await houseElement.$(".address");
  const shortAddress = await address.$eval("div", (e) => e.innerText);
  const cleanedShortAddress = cleanAddress(shortAddress);
  fs.mkdir(`Data/Houses/${cleanedShortAddress}`, { recursive: true }, (err) => {
    if (err) {
      return console.error(err);
    }
    console.log(`Created ${cleanedShortAddress} directory`);
  });
};

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

  await page.waitForSelector("#PriceSection-secondary", { hidden: true });
  await page.waitForSelector(".property-thumbnail-item");

  const houseElements = await page.$$(".property-thumbnail-item");
  for (const houseElement of houseElements) {
    await scrapeSingleHouse(houseElement);
  }

  await page.screenshot({ path: "screenshot.png" });

  await browser.close();
};

scrapeWebsite().catch((error) => {
  console.error(error);
});
