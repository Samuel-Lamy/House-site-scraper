import { promises as fs } from "fs";
import fsStd from "fs";
import _ from "lodash";

export const cleanAddress = (address) => {
  const cleanedAddress = address
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/g, "_");
  return cleanedAddress;
};

export const getAddressToHouse = async (houseList) => {
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

export const getNewHousesAddresses = async (addressList, filename) => {
  let uniqueNewAddresses;
  let uniqueOldAddresses;
  if (!fsStd.existsSync(filename)) {
    await fs.writeFile(filename, "");
    uniqueNewAddresses = addressList;
  } else {
    const addressData = await fs.readFile(filename, "utf8");
    const existingAddresses = new Set(
      addressData.split("\n")?.filter((address) => address.trim() !== "")
    );

    uniqueNewAddresses = addressList?.filter(
      (address) => !existingAddresses.has(address)
    );
    uniqueOldAddresses = addressList?.filter((address) =>
      existingAddresses.has(address)
    );
  }

  const dbOldAdresses = await fetch("http://localhost:3005/houseList", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res?.json());

  const houseList = _.map(Object.values(uniqueNewAddresses), (address) => {
    return {
      address: address,
      isDirCreated: false,
      isThumbnailFetched: false,
      areDetailsFetched: false,
    };
  }).concat(dbOldAdresses);

  await fetch("http://localhost:3005/houseList", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ houseList }),
  });

  return { uniqueNewAddresses, uniqueOldAddresses, houseList };
};

export const writeAddressesToFile = async (addressList, filename) => {
  const addressData = addressList.join("\n") + "\n";
  fs.appendFile(filename, addressData);
};

export const extractNumber = (inputString) => {
  const numericString = inputString.replace(/\D/g, "");
  const number = parseFloat(numericString);
  return number;
};

export const toTextNumValue = (inputString) => {
  if (inputString === undefined) {
    return undefined;
  }
  return { text: inputString, value: extractNumber(inputString) };
};
