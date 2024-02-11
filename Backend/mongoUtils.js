import mongoose from "mongoose";

export const runDB = async () => {
  mongoose.connect("mongodb://localhost:27017/houseScraperInfo");
};
