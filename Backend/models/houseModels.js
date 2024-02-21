import mongoose from "mongoose";
const { Schema, model } = mongoose;

const textNumValueSchema = new Schema({
  text: { type: String, required: true },
  value: { type: Number },
});

export const genericInfoSchema = new Schema({
  price: [Number],
  dateAdded: { type: Date, default: Date.now },
  dateUpdated: { type: Date, default: Date.now },
});

export const thumbnailInfoSchema = new Schema({
  price: { type: textNumValueSchema, required: true },
  title: String,
  addressArray: [String],
  bedrooms: textNumValueSchema,
  bathrooms: textNumValueSchema,
  sqft: textNumValueSchema,
  nbPictures: textNumValueSchema,
});

export const detailedInfoSchema = new Schema({
  teaserCaracteristics: Schema.Types.Mixed,
  generalCaracteristics: Schema.Types.Mixed,
});

const houseSchema = new Schema({
  generalInfo: genericInfoSchema,
  thumbnailInfo: thumbnailInfoSchema,
  detailsInfo: detailedInfoSchema,
});

export const HouseData = model("Houses", houseSchema);
