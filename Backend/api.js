import express from "express";
import mongoose from "mongoose";
import { HouseData } from "./models/houseModels.js";
import { HouseList } from "./models/houseList.js";
import { createFrontend } from "../Frontend/createFrontend.js";

const app = express();
const port = 3005;

app.use(express.json());

(async () => {
  try {
    const MongoDB = await mongoose.connect(
      "mongodb://localhost:27017/houseScraperInfo"
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
})();

let dbInUse = false;

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/newHouse/thumbnail/:id", async (req, res) => {
  while (dbInUse) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  dbInUse = true;
  try {
    await HouseData.findOneAndUpdate(
      { _id: req.params.id },
      { thumbnailInfo: req.body }
    ).then(() => {
      dbInUse = false;
      res.sendStatus(200);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

app.post("/newHouse/details/:id", async (req, res) => {
  while (dbInUse) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  dbInUse = true;
  try {
    await HouseData.findOneAndUpdate(
      { _id: req.params.id },
      { detailsInfo: req.body }
    ).then(() => {
      dbInUse = false;
      res.sendStatus(200);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

app.post("/newHouse/general/:address", async (req, res) => {
  while (dbInUse) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  dbInUse = true;
  await HouseData.findOne({
    "generalInfo.cleanedAddress": req.body.cleanedAddress,
  }).then((data) => {
    if (data) {
      if (
        data.generalInfo.price[data.generalInfo.price.length - 1] !==
        req.body.price
      ) {
        data.generalInfo.price.push(req.body.price);
      }
      data.generalInfo.dateUpdated = Date.now();
      data.save();
      dbInUse = false;
      res.send(data._id);
    } else {
      const newHouse = new HouseData({ generalInfo: req.body });
      newHouse.save();
      dbInUse = false;
      res.send(newHouse._id);
    }
  });
});

app.post("/houseList", async (req, res) => {
  const houseList = await HouseList.findOne();
  if (houseList) {
    Object.assign(houseList, req.body);
    await houseList.save();
  } else {
    const newHouseList = new HouseList(req.body);
    await newHouseList.save();
  }
  res.sendStatus(200);
});

app.get("/houseList", async (req, res) => {
  await HouseList.findOne().then((data) => {
    if (!data) return res.send([]);
    return res.send(data.houseList);
  });
});

app.get("/frontend", async (req, res) => {
  createFrontend().then((data) => {
    res.send(data);
  });
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
