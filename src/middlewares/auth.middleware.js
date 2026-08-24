import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const authCheck = asyncHandler(async (req, _res, next) => {
  const { userId } = req.session ?? {};
  if (!userId) throw new ApiError(401, "Authentication required.");

  req.user = { id: userId };
  next();
});

export default authCheck;
