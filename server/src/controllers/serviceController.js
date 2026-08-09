const Service = require("../models/Service");
const serviceCategories = require("../constants/serviceCategories");
const asyncHandler = require("../utils/asyncHandler");
const { validateObjectId, validateServicePayload } = require("../utils/validators");

const getServices = asyncHandler(async (_request, response) => {
  const services = await Service.find().sort({ category: 1, price: 1, name: 1 });

  const grouped = serviceCategories.reduce((accumulator, category) => {
    accumulator[category] = [];
    return accumulator;
  }, {});

  services.forEach((service) => {
    grouped[service.category].push(service);
  });

  response.set("Cache-Control", "no-store").json(grouped);
});

const createService = asyncHandler(async (request, response) => {
  const { name, price, category } = validateServicePayload(request.body);

  const service = await Service.create({
    name,
    price,
    category,
  });

  response.status(201).json(service);
});

const updateService = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "service");
  const service = await Service.findById(request.params.id);

  if (!service) {
    throw Object.assign(new Error("Service not found"), { statusCode: 404 });
  }

  const updates = validateServicePayload(request.body, { partial: true });

  if (updates.name !== undefined) {
    service.name = updates.name;
  }

  if (updates.price !== undefined) {
    service.price = updates.price;
  }

  if (updates.category !== undefined) {
    service.category = updates.category;
  }

  await service.save();

  response.json(service);
});

const deleteService = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "service");
  const service = await Service.findById(request.params.id);

  if (!service) {
    throw Object.assign(new Error("Service not found"), { statusCode: 404 });
  }

  await service.deleteOne();

  response.json({ message: "Service deleted" });
});

module.exports = {
  getServices,
  createService,
  updateService,
  deleteService,
};
