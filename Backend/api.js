import express from "express";
import mongoose from "mongoose";
import { HouseData } from "./models/houseModels.js";

const app = express();
const port = 3005;

app.use(express.json());

(async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/houseScraperInfo");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
})();

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/newHouse/thumbnail/:id", async (req, res) => {
  try {
    await HouseData.findOneAndUpdate(
      { _id: req.params.id },
      { thumbnailInfo: req.body }
    ).then(() => {
      res.sendStatus(200);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

app.post("/newHouse/details/:id", async (req, res) => {
  await HouseData.findOneAndUpdate(
    { _id: req.params.id },
    { detailsInfo: req.body }
  ).then(() => {
    res.sendStatus(200);
  });
});

app.post("/newHouse/general/:address", async (req, res) => {
  await HouseData.findOne({ address: req.params.address }).then((data) => {
    if (data) {
      if (
        data.generalInfo.price[data.generalInfo.price.length - 1] !==
        req.body.price
      ) {
        data.generalInfo.price.push(req.body.price);
      }
      data.generalInfo.dateUpdated = Date.now();
      data.save();
      res.send(data._id);
    } else {
      const newHouse = new HouseData({ generalInfo: req.body });
      newHouse.save();
      res.send(newHouse._id);
    }
  });
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
