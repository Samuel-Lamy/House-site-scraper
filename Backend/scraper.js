import {
  cleanAddress,
  getAddressToHouse,
  getNewHousesAddresses,
  writeAddressesToFile,
  extractNumber,
  toTextNumValue,
} from "./scraperUtils.js";
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import axios from "axios";
import _ from "lodash";

let houseList;

let fetchQueue = [];
const removePotentiallyUselessItem = _.throttle(async () => {
  const potentiallyUselessItem = fetchQueue[0];
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (fetchQueue[0] === potentiallyUselessItem) {
    fetchQueue.shift();
  }
}, 5000);

const makeFetchRequestWhenServerIsReady = async (funcToCall) => {
  fetchQueue.push(funcToCall);
  while (true) {
    try {
      while (fetchQueue[0] !== funcToCall) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (fetchQueue.length === 0) {
          fetchQueue.push(funcToCall);
        }
        removePotentiallyUselessItem();
      }
      const result = await funcToCall();
      fetchQueue.shift();
      return result;
    } catch (_) {}
  }
};

const getHouseThumbnailInfo = async (houseElement, dirPath, houseId) => {
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

  await makeFetchRequestWhenServerIsReady(
    async () =>
      await fetch(`http://localhost:3005/newHouse/thumbnail/${houseId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(houseData),
      }).then((response) => {
        if (!response.ok) {
          console.error(`Server responded with ${response.status}`);
        }
      })
  );

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
  houseId,
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

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    request.continue();
  });

  while (true) {
    try {
      await page.goto(link);

      await page.waitForResponse((response) =>
        response.url().includes("https://www.centris.ca")
      );
      await page.waitForSelector("body");
      break;
    } catch (_) {}
  }
  const htmlHouseData = await page.$eval(
    "body",
    (htmlHouseData) => htmlHouseData.innerHTML
  );

  await page.screenshot({ path: "screenshot8.png" });

  try {
    const teaserCaracteristics = await page.$$eval(
      "#overview .grid_3 .description .teaser div",
      (caract) =>
        caract.map((c) => {
          return c.innerText;
        })
    );

    const generalCaracteristicsTitles = await page.$$eval(
      "#overview .carac-container .carac-title",
      (caract) =>
        caract.map((c) => {
          return c.innerText;
        })
    );

    const generalCaracteristicsValues = await page.$$eval(
      "#overview .carac-container .carac-value > span",
      (caract) =>
        caract.map((c) => {
          return c.innerText;
        })
    );

    let generalCaracteristics = {};
    for (let i = 0; i < generalCaracteristicsTitles.length; i++) {
      generalCaracteristics[generalCaracteristicsTitles[i]] =
        generalCaracteristicsValues[i];
    }

    const detailedInfo = {
      teaserCaracteristics: teaserCaracteristics,
      generalCaracteristics: generalCaracteristics,
    };

    await makeFetchRequestWhenServerIsReady(
      async () =>
        await fetch(`http://localhost:3005/newHouse/details/${houseId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(detailedInfo),
        }).then((response) => {
          if (!response.ok) {
            console.error(`Server responded with ${response.status}`);
          }
        })
    );
  } catch (e) {}

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
      await page.waitForSelector("#overview");
      const { width, height } = await page.viewport();

      const centerX = width / 2;
      const offsetY = height * 0.75;

      await page.mouse.click(centerX, offsetY);

      await page.waitForResponse((response) =>
        response.url().includes("https://mspublic.centris.ca/media.ashx?id=")
      );

      const gallery = await page.$("#gallery");
      const testPageNumbers = await page.$(
        ".image-wrapper > .description > strong"
      );
      if (!testPageNumbers) {
        await page.mouse.click(centerX, offsetY);
        await page.waitForResponse((response) =>
          response.url().includes("https://mspublic.centris.ca/media.ashx?id=")
        );
      }
      const pageNumbers = await gallery.$eval(
        ".image-wrapper > .description > strong",
        (pageNb) => pageNb.innerText
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
        try {
          await imageElem.click();
        } catch (_) {
          page.screenshot({ path: "screenshot6.png" });
        }
        if (lastPage !== currentPage) {
          await page.waitForResponse((response) =>
            response.url().includes("https://mspublic.centris.ca/media.ashx")
          );
        }
      } while (lastPage > currentPage);
    });
};

const getHouseGeneralInfo = async (houseElement) => {
  const address = await houseElement.$(".address");
  const shortAddress = await address.$eval("div", (e) => e.innerText);
  const cleanedShortAddress = cleanAddress(shortAddress);
  const price = extractNumber(
    await houseElement.$eval(".price > span", (price) => price.innerText)
  );
  const houseId = await makeFetchRequestWhenServerIsReady(
    async () =>
      await fetch(
        `http://localhost:3005/newHouse/general/${cleanedShortAddress}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ price: price }),
        }
      ).then((response) => {
        if (!response.ok) {
          console.error(`Server responded with ${response.status}`);
        }
        return response.json();
      })
  );
  return houseId;
};

const scrapeSingleHouse = async (houseElement, browser, baseURL) => {
  const address = await houseElement.$(".address");
  const shortAddress = await address.$eval("div", (e) => e.innerText);
  const cleanedShortAddress = cleanAddress(shortAddress);
  const dir = `Data/Houses/${cleanedShortAddress}`;
  const houseId = await getHouseGeneralInfo(houseElement);
  if (
    !houseList.find((house) => house.address === cleanedShortAddress)
      .isDirCreated
  ) {
    const mkdirPromise = fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        return console.error(err);
      }
    });
    await mkdirPromise;
    houseList.find(
      (house) => house.address === cleanedShortAddress
    ).isDirCreated = true;
    console.log(`Created ${cleanedShortAddress} directory`);
  }

  if (
    !houseList.find((house) => house.address === cleanedShortAddress)
      .isThumbnailFetched
  ) {
    await getHouseThumbnailInfo(houseElement, dir, houseId);
    houseList.find(
      (house) => house.address === cleanedShortAddress
    ).isThumbnailFetched = true;
    console.log(`ThumbnailInfo from ${cleanedShortAddress} stored`);
  }

  if (
    !houseList.find((house) => house.address === cleanedShortAddress)
      .areDetailsFetched
  ) {
    await getHouseDetailedInfo(houseElement, dir, houseId, browser, baseURL);
    houseList.find(
      (house) => house.address === cleanedShortAddress
    ).areDetailsFetched = true;
    console.log(`DetailedInfo from ${cleanedShortAddress} stored`);
  }
};

const scrapeWebsite = async () => {
  await fetch("http://localhost:3005/")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response;
    })
    .then()
    .catch((error) => {
      console.error("Server is not working correctly");
      throw error;
    });
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

  await page.waitForResponse((response) =>
    response.url().includes("https://www.centris.ca/property/GetPropertyCount")
  );
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
    houseList: defaultHouseList,
  } = await getNewHousesAddresses(Object.keys(addressToHouse), filename);

  houseList = defaultHouseList;

  await writeAddressesToFile(newHouseAddresses, filename);
  const newHouseElements = newHouseAddresses?.map((key) => addressToHouse[key]);
  const oldHouseElements = oldHouseAddresses?.map((key) => addressToHouse[key]);

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

scrapeWebsite()
  .then(() => {
    if (houseList !== undefined) {
      fetch("http://localhost:3005/houseList", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ houseList }),
      });
    }
    return console.log("Done");
  })
  .catch((error) => {
    if (houseList !== undefined) {
      fetch("http://localhost:3005/houseList", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ houseList }),
      }).then(() => {
        console.log("error");
        console.error(error);
        process.exit(1);
      });
    } else {
      console.log("error");
      console.error(error);
      process.exit(1);
    }
  });
