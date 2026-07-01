/**
 * Go-style tuple error handler. Always `await` the result.
 * Returns [error, data] — error is null on success, data is null on failure.
 *
 * @param {Function|any} input - Function to call, promise to await, or plain value
 * @param {...any} args - Arguments if input is a function
 * @returns {Promise<[Error|null, any]>|[Error|null, any]}
 */
const attempt = (input, ...args) => {
  try {
    const value = typeof input === "function" ? input(...args) : input;

    // Plain sync value (not a thenable)
    if (!value || typeof value.then !== "function") {
      return [null, value];
    }

    // Promise / thenable
    return value.then((data) => [null, data]).catch((error) => [error, null]);
  } catch (error) {
    // Sync throw before any promise was returned
    return Promise.resolve([error, null]);
  }
};

/** Manually construct a success tuple */
attempt.ok = (value) => [null, value];

/** Manually construct a failure tuple */
attempt.err = (error) => [error, null];

export default attempt;
