function createHttpError(statusCode, message, details, errorCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (errorCode) {
    error.errorCode = errorCode;
  }

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

module.exports = createHttpError;
