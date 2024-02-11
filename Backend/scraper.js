import {
  cleanAddress,
  getAddressToHouse,
  getNewHousesAddresses,
  writeAddressesToFile,
  toTextNumValue,
} from "./scraperUtils.js";
import { runDB } from "./mongoUtils.js";
import { HouseData } from "./models/houseModels.js";

import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import axios from "axios";

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
    price: toTextNumValue(price),
    title: title,
    addressArray: addressArray,
    bedrooms: toTextNumValue(bedrooms),
    bathrooms: toTextNumValue(bathrooms),
    sqft: toTextNumValue(sqft),
    nbPictures: toTextNumValue(nbPictures),
  };

  const newHouse = new HouseData({ thumbnailInfo: houseData });
  newHouse.save();

  const jsonHouseData = JSON.stringify(houseData, null, 2);
  const htmlHouseData = await houseElement.$eval(
    ".shell",
    (htmlHouseData) => htmlHouseData.innerHTML
  );

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
    fs.writeFile(`${thumbnailDir}/htmlHouseData.html`, htmlHouseData);
  });
};

const getHouseDetailedInfo = async (
  houseElement,
  dirPath,
  browser,
  baseURL
) => {
  const linkElement = await houseElement.$("a");
  const link = new URL(
    await linkElement.evaluate((node) => node.getAttribute("href")),
    baseURL
  ).href;
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134"
  );
  await page.goto(link);

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    request.continue();
  });

  await page.waitForSelector("body");
  const htmlHouseData = await houseElement.$eval(
    "div",
    (htmlHouseData) => htmlHouseData.innerHTML
  );

  const detailedInfoDir = dirPath + "/detailed_info";
  await fs
    .mkdir(detailedInfoDir, { recursive: true }, (err) => {
      if (err) {
        return console.error(err);
      }
    })
    .then(() => {
      fs.writeFile(`${detailedInfoDir}/htmlHouseData.html`, htmlHouseData);
    });

  const picturesDir = detailedInfoDir + "/pictures";
  await fs
    .mkdir(picturesDir, { recursive: true }, (err) => {
      if (err) {
        return console.error(err);
      }
    })
    .then(async () => {
      const { width, height } = await page.viewport();

      const centerX = width / 2;
      const offsetY = height * 0.85;

      await page.mouse.click(centerX, offsetY);
      await page.waitForResponse((response) =>
        response.url().includes("https://mspublic.centris.ca/media.ashx")
      );

      const gallery = await page.$("#gallery");
      const pageNumbers = await gallery.$eval(
        ".description > strong",
        (pageNb) => pageNb.innerHTML
      );
      let currentPage = 1;
      const lastPage = pageNumbers.split("/")[1];
      do {
        const imageElem = await page.$("#fullImg");
        const imageLink = await imageElem.evaluate((node) =>
          node.getAttribute("src")
        );
        const imageResponse = await axios.get(imageLink, {
          responseType: "arraybuffer",
        });
        fs.writeFile(
          picturesDir + `/${currentPage}.jpg`,
          imageResponse.data,
          "binary"
        );
        currentPage++;
        await imageElem.click();
        if (lastPage !== currentPage) {
          await page.waitForResponse((response) =>
            response.url().includes("https://mspublic.centris.ca/media.ashx")
          );
        }
      } while (lastPage > currentPage);
    });
};

const scrapeSingleHouse = async (houseElement, isNew, browser, baseURL) => {
  const address = await houseElement.$(".address");
  const shortAddress = await address.$eval("div", (e) => e.innerText);
  const cleanedShortAddress = cleanAddress(shortAddress);
  const dir = `Data/Houses/${cleanedShortAddress}`;
  if (isNew) {
    const mkdirPromise = fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        return console.error(err);
      }
    });
    await mkdirPromise;
    console.log(`Created ${cleanedShortAddress} directory`);

    await getHouseThumbnailInfo(houseElement, dir);
    await getHouseDetailedInfo(houseElement, dir, browser, baseURL);
  }
};

const scrapeWebsite = async () => {
  await runDB();
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134"
  );

  await page.goto(
    "https://www.centris.ca/fr/propriete~a-vendre~trois-rivieres"
  );

  const baseURL = new URL(page.url()).origin;

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    request.continue();
  });

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
  await page.waitForResponse((response) =>
    response.url().includes("https://www.centris.ca/fr/propriete")
  );

  let nextButton;
  let houseElements = [];
  let scannedLastPage = false;
  do {
    await page.waitForSelector(".property-thumbnail-item");

    houseElements = houseElements.concat(
      await page.$$(".property-thumbnail-item")
    );
    nextButton = await page.$(".next");

    if (nextButton) {
      if (
        await nextButton.evaluate((nextButtonNode) =>
          nextButtonNode.classList.contains("inactive")
        )
      ) {
        scannedLastPage = true;
      }
      await nextButton.click();
      if (!scannedLastPage) {
        await page.waitForResponse((response) =>
          response.url().includes("GetInscriptions")
        );
      }
    }
  } while (
    nextButton &&
    (!(await nextButton.evaluate((nextButtonNode) =>
      nextButtonNode.classList.contains("inactive")
    )) ||
      !scannedLastPage)
  );
  const filename = "AddressList.txt";
  const addressToHouse = await getAddressToHouse(houseElements);
  const {
    uniqueNewAddresses: newHouseAddresses,
    uniqueOldAddresses: oldHouseAddresses,
  } = await getNewHousesAddresses(Object.keys(addressToHouse), filename);
  writeAddressesToFile(newHouseAddresses, filename);
  const newHouseElements = newHouseAddresses.map((key) => addressToHouse[key]);
  const oldHouseElements = oldHouseAddresses.map((key) => addressToHouse[key]);

  await Promise.all(
    newHouseElements.map(async (house) =>
      scrapeSingleHouse(house, true, browser, baseURL)
    )
  );
  await Promise.all(
    oldHouseElements.map(async (house) =>
      scrapeSingleHouse(house, false, browser, baseURL)
    )
  );

  await page.screenshot({ path: "screenshot.png" });

  await browser.close();
};

scrapeWebsite().catch((error) => {
  console.error(error);
});
