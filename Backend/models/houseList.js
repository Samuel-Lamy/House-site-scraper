import mongoose from "mongoose";

const houseSchema = new mongoose.Schema({
  address: String,
  isDirCreated: Boolean,
  isThumbnailFetched: Boolean,
  areDetailsFetched: Boolean,
});

const houseListSchema = new mongoose.Schema({
  houseList: [houseSchema],
});

export const HouseList = mongoose.model("HouseList", houseListSchema);
