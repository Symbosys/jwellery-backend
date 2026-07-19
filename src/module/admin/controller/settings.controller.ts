import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.utils.js";
import { uploadToCloudinary } from "../../../config/cloudinary.js";

async function processBase64Image(base64String: string, folder: string): Promise<string> {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String; 
  }
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3 || !matches[2]) {
    return base64String;
  }
  const imageBuffer = Buffer.from(matches[2] as string, 'base64');
  const result = await uploadToCloudinary(imageBuffer, folder);
  return result.secure_url;
}

export const getWebConfig = asyncHandler(async (req, res, next) => {
  try {
    let config = await prisma.webConfig.findFirst();
    if (!config) {
      config = await prisma.webConfig.create({
        data: {
          storeName: "",
          businessEmail: "",
          phoneNumber: "",
          website: "",
          storeDescription: "",
          pickupAddresses: [],
        },
      });
    }
    return SuccessResponse(res, "Web config settings fetched successfully", config);
  } catch (err) {
    next(err);
  }
});

export const updateWebConfig = asyncHandler(async (req, res, next) => {
  try {
    let config = await prisma.webConfig.findFirst();
    if (!config) {
      config = await prisma.webConfig.create({
        data: {
          storeName: "",
          businessEmail: "",
          phoneNumber: "",
          pickupAddresses: [],
        },
      });
    }

    const {
      storeName,
      businessEmail,
      phoneNumber,
      website,
      storeDescription,
      bankName,
      accountHolderName,
      accountNumber,
      routingNumber,
      gstNumber,
      panNumber,
      registeredBusinessName,
      pickupAddresses, // JSON array of addresses passed from the client
    } = req.body;

    let logoUrl = config.logo;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, "settings");
      logoUrl = uploadResult.secure_url;
    } else if (req.body.logo) {
      logoUrl = await processBase64Image(req.body.logo, "settings");
    }

    // Parse pickupAddresses if it is passed as a string
    let finalPickupAddresses = pickupAddresses;
    if (typeof pickupAddresses === "string") {
      try {
        finalPickupAddresses = JSON.parse(pickupAddresses);
      } catch (e) {
        finalPickupAddresses = config.pickupAddresses;
      }
    }

    const updatedConfig = await prisma.webConfig.update({
      where: { id: config.id },
      data: {
        storeName: storeName !== undefined ? storeName : config.storeName,
        businessEmail: businessEmail !== undefined ? businessEmail : config.businessEmail,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : config.phoneNumber,
        website: website !== undefined ? website : config.website,
        storeDescription: storeDescription !== undefined ? storeDescription : config.storeDescription,
        logo: logoUrl,
        bankName: bankName !== undefined ? bankName : config.bankName,
        accountHolderName: accountHolderName !== undefined ? accountHolderName : config.accountHolderName,
        accountNumber: accountNumber !== undefined ? accountNumber : config.accountNumber,
        routingNumber: routingNumber !== undefined ? routingNumber : config.routingNumber,
        gstNumber: gstNumber !== undefined ? gstNumber : config.gstNumber,
        panNumber: panNumber !== undefined ? panNumber : config.panNumber,
        registeredBusinessName: registeredBusinessName !== undefined ? registeredBusinessName : config.registeredBusinessName,
        pickupAddresses: finalPickupAddresses !== undefined ? finalPickupAddresses : config.pickupAddresses,
      },
    });

    return SuccessResponse(res, "Web config settings updated successfully", updatedConfig);
  } catch (err) {
    next(err);
  }
});
