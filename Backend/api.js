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

app.post("/newHouse/thumbnail", (req, res) => {
  const newHouse = new HouseData({ thumbnailInfo: req.body });
  newHouse.save();
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
