const createHttpError = require("../utils/httpError");

const STATUS_CODES = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_SERVER_ERROR",
  502: "UPSTREAM_SERVICE_ERROR",
};

function notFound(_request, _response, next) {
  next(
    createHttpError(
      404,
      "The requested resource could not be found.",
      undefined,
      "NOT_FOUND",
    ),
  );
}

function errorHandler(error, _request, response, _next) {
  let statusCode =
    error.statusCode || (response.statusCode === 200 ? 500 : response.statusCode);
  let message = error.message || "Internal server error";
  let details = error.details;
  let errorCode = error.errorCode;

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    details = Object.values(error.errors).map((item) => item.message);
    errorCode = "VALIDATION_ERROR";
  }

  if (error.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${error.path}`;
    errorCode = "VALIDATION_ERROR";
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists";
    details = undefined;
    errorCode = "CONFLICT";
  }

  if (error.name === "MulterError") {
    statusCode = 400;
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the 5MB size limit"
        : error.message;
    errorCode = "VALIDATION_ERROR";
  }

  const code = errorCode || STATUS_CODES[statusCode] || "INTERNAL_SERVER_ERROR";
  const safeMessage = statusCode >= 500 ? "Something went wrong on the server." : message;

  if (statusCode >= 500) {
    console.error(`Server Error [${code}]: ${message}`);
  }

  response.status(statusCode).json({
    error: {
      status: statusCode,
      code,
      message: safeMessage,
      ...(details !== undefined && { details }),
    },
  });
}

module.exports = { notFound, errorHandler };
