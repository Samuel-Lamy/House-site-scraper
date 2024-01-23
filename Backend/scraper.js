const puppeteer = require('puppeteer');
const fs = require('fs');

const scrapeWebsite = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://www.example.com');

  const data = await page.evaluate(() => {
    const text = document.querySelector('p').innerText;

    return {
        text,
    };
  });

  await browser.close();
  return data;
};

scrapeWebsite().then((result) => {
    const dataString = JSON.stringify(result, null, 2);
    fs.writeFileSync('Data/scrapedData.txt', dataString, 'utf-8');
  }).catch((error) => {
    console.error(error);
  });