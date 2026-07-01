/**
 * Strips internal/sensitive fields from a Mongoose user document before
 * sending it in a response.
 *
 * Fields already excluded at the schema level (select: false) — password,
 * oauth.google.id, emailVerifiedAt, failedLoginAttempts, lockoutUntil,
 * lastFailedLoginAt, passwordChangedAt, lastLoginIp, deletedAt — won't
 * even be present on the document here, so no need to explicitly remove them.
 *
 * This handles the remaining fields that ARE returned by default but belong
 * to the server, not the client.
 *
 * @param {import("mongoose").Document} user
 * @returns {Object}
 */
const sanitizeUser = (user) => {
  // Convert to plain object if it's a Mongoose document.
  // .toObject() removes Mongoose internals and makes it safely mutable.
  const obj = user.toObject ? user.toObject() : { ...user };

  // _id — internal Mongo ObjectId, publicId is the safe external identifier
  delete obj._id;

  // __v — Mongoose version key, never useful to clients
  delete obj.__v;

  // oauth — internal provider linkage, google.id is already select:false
  // but the empty wrapper object (oauth: { google: {} }) would still leak
  delete obj.oauth;

  return obj;
};

export default sanitizeUser;
