import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import ApiError from "../utils/ApiError.js";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//ToDo: Rewrite So That isVideoOrThumbnail Flag DIs No Needed!
async function fileUploader(userName, fileName, filePath, isVideoOrThumbnail) {
  try {
    const options = {
      public_id: fileName,
      resource_type: "auto",
      asset_folder: `VideoTube/${userName}/Avatar+CoverImage`,
    };

    if (!userName) return "Error: User Name Not Found!";
    if (!fileName) return "Error: File Name Not Found!";
    if (!filePath) return "Error: File Path Not Found!";

    if (isVideoOrThumbnail)
      options.asset_folder = `VideoTube/${userName}/Videos`;

    // Uploading Files
    const uploadResult = await cloudinary.uploader.upload(filePath, options);
    fs.unlinkSync(filePath);
    //console.log(uploadResult);
    return uploadResult;
  } catch (error) {
    fs.unlinkSync(filePath);
    console.error("Error While Uploading File On Cloudinary!, Error: ", error);
    throw new ApiError(500, "Error While Uploading File!", error);
  }

  // Optimize delivery by resizing and applying auto-format and auto-quality
  /*const optimizeUrl = cloudinary.url("shoes", {
    fetch_format: "auto",
    quality: "auto",
  });

  console.log(optimizeUrl);

  // Transform the image: auto-crop to square aspect_ratio
  const autoCropUrl = cloudinary.url("shoes", {
    crop: "auto",
    gravity: "auto",
    width: 500,
    height: 500,
  });

  console.log(autoCropUrl);*/
}

//ToDo: Send Response Based On Which File Is Deleted! + Unlink Files When Done
async function fileDeleter(
  videoFile,
  thumbnail,
  videoFilePath,
  thumbnailFilePath
) {
  try {
    let deletedVideo;
    let deletedThumbnail;

    if (videoFile) {
      const videoFileName = videoFile.split("/").pop().split(".")[0];
      deletedVideo = await cloudinary.api.delete_resources([videoFileName], {
        type: "upload",
        resource_type: "video",
      });
      if (deletedVideo?.deleted[videoFileName] !== "deleted") {
        fs.unlinkSync(videoFilePath);
        throw new ApiError(
          500,
          "Something Went Wrong While Deleting Video File!"
        );
      }
      return true;
    }

    if (thumbnail) {
      const thumbnailFileName = thumbnail.split("/").pop().split(".")[0];
      deletedThumbnail = await cloudinary.api.delete_resources(
        [thumbnailFileName],
        { type: "upload", resource_type: "image" }
      );
      if (deletedThumbnail?.deleted[thumbnailFileName] !== "deleted") {
        fs.unlinkSync(thumbnailFilePath);
        throw new ApiError(
          500,
          "Something Went Wrong While Deleting Video File!"
        );
      }
      //console.log("Deleted Thumbnail: ", deletedThumbnail);
      return true;
    }
  } catch (error) {
    //fs.unlinkSync(filePath);
    console.error("Error While Deleting File: ", error);
  }
}

export { fileUploader, fileDeleter };