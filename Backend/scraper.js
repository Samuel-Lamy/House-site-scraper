const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const fsStd = require("fs");
const axios = require("axios");

const cleanAddress = (address) => {
  const cleanedAddress = address
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/g, "_");
  return cleanedAddress;
};

const getAddressToHouse = async (houseList) => {
  let AddressToHouse = {};
  await Promise.all(
    houseList.map(async (houseElement) => {
      const address = await houseElement.$eval(
        ".address > div",
        (address) => address.innerText
      );
      AddressToHouse[cleanAddress(address)] = houseElement;
    })
  );
  return AddressToHouse;
};

const getNewHousesAddresses = async (addressList, filename) => {
  if (!fsStd.existsSync(filename)) {
    await fs.writeFile(filename, "");
    return addressList;
  }
  const addressData = await fs.readFile(filename, "utf8");
  const existingAddresses = new Set(
    addressData.split("\n")?.filter((address) => address.trim() !== "")
  );

  const uniqueNewAddresses = addressList?.filter(
    (address) => !existingAddresses.has(address)
  );
  return uniqueNewAddresses;
};

const writeAddressesToFile = async (addressList, filename) => {
  const addressData = addressList.join("\n");
  fs.writeFile(filename, addressData);
};

const getHouseThumbnailInfo = async (houseElement, dirPath) => {
  const thumbnailImgLink = await houseElement.$eval(
    ".property-thumbnail-summary-link > img",
    (image) => image.src
  );
  const imageResponse = await axios.get(thumbnailImgLink, {
    responseType: "arraybuffer",
  });

  const price = await houseElement.$eval(
    ".price > span",
    (price) => price.innerText
  );
  const title = await houseElement.$eval(
    ".category > div",
    (title) => title.innerText
  );
  const addressArray = await houseElement.$$eval(
    ".address > div",
    (address) => address.innerText
  );
  const bedroomsElement = await houseElement.$(".cac");
  const bedrooms = await bedroomsElement?.evaluate(
    (bedrooms) => bedrooms?.innerText
  );
  const bathroomsElement = await houseElement.$(".sdb");
  const bathrooms = await bathroomsElement?.evaluate(
    (bathrooms) => bathrooms?.innerText
  );
  const sqftElement = await houseElement.$(".sqft");
  const sqft = await sqftElement?.evaluate((sqft) => sqft?.innerText);
  const nbPictures = await houseElement.$eval(
    ".photo-buttons > button",
    (nbPictures) => nbPictures.innerText
  );

  const houseData = {
    price,
    title,
    addressArray,
    bedrooms,
    bathrooms,
    sqft,
    nbPictures,
  };

  const jsonHouseData = JSON.stringify(houseData, null, 2);

  const thumbnailDir = dirPath + "/thumbnail_info";
  fs.mkdir(thumbnailDir, { recursive: true }, (err) => {
    if (err) {
      return console.error(err);
    }
  }).then(() => {
    fs.writeFile(
      `${thumbnailDir}/house_thumbnail.jpg`,
      imageResponse.data,
      "binary"
    );
    fs.writeFile(`${thumbnailDir}/houseData.json`, jsonHouseData);
  });
};

const scrapeSingleHouse = async (houseElement) => {
  const address = await houseElement.$(".address");
  const shortAddress = await address.$eval("div", (e) => e.innerText);
  const cleanedShortAddress = cleanAddress(shortAddress);
  const dir = `Data/Houses/${cleanedShortAddress}`;
  const mkdirPromise = fs.mkdir(dir, { recursive: true }, (err) => {
    if (err) {
      return console.error(err);
    }
  });
  await mkdirPromise;
  console.log(`Created ${cleanedShortAddress} directory`);

  await getHouseThumbnailInfo(houseElement, dir);
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

  await page.waitForSelector("#PriceSection-secondary");
  const PriceSectionSec = await page.$("#PriceSection-secondary");
  if (PriceSectionSec) {
    await page.waitForSelector("#PriceSection-secondary", { hidden: true });
  }
  let nextButton;
  let houseElements = [];
  do {
    await page.waitForSelector(".property-thumbnail-item");

    houseElements = houseElements.concat(
      await page.$$(".property-thumbnail-item")
    );

    nextButton = await page.$(".next");

    if (nextButton) {
      await nextButton.click();
    }
  } while (
    nextButton &&
    !(await nextButton.evaluate((nextButtonNode) =>
      nextButtonNode.classList.contains("inactive")
    ))
  );
  const filename = "AddressList.txt";
  const addressToHouse = await getAddressToHouse(houseElements);
  const newHouseAddresses = await getNewHousesAddresses(
    Object.keys(addressToHouse),
    filename
  );
  writeAddressesToFile(newHouseAddresses, filename);
  const newHouseElements = newHouseAddresses.map((key) => addressToHouse[key]);

  await Promise.all(newHouseElements.map(scrapeSingleHouse));

  await page.screenshot({ path: "screenshot.png" });

  await browser.close();
};

scrapeWebsite().catch((error) => {
  console.error(error);
});
