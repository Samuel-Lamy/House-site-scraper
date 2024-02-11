import mongoose from "mongoose";
const { Schema, model } = mongoose;

const textNumValueSchema = new Schema({
  text: { type: String, required: true },
  value: { type: Number },
});

export const genericInfoSchema = new Schema({});

export const thumbnailInfoSchema = new Schema({
  price: { type: textNumValueSchema, required: true },
  title: String,
  addressArray: [String],
  bedrooms: textNumValueSchema,
  bathrooms: textNumValueSchema,
  sqft: textNumValueSchema,
  nbPictures: textNumValueSchema,
});

export const detailedInfoSchema = new Schema({});

const houseSchema = new Schema({
  thumbnailInfo: { type: thumbnailInfoSchema, required: true },
});

export const HouseData = model("Houses", houseSchema);
