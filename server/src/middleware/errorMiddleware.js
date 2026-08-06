function notFound(request, response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _request, response, _next) {
  let statusCode = error.statusCode || (response.statusCode === 200 ? 500 : response.statusCode);
  let message = error.message || "Internal server error";
  let details = error.details;

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    details = Object.values(error.errors).map((item) => item.message);
  }

  if (error.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${error.path}`;
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists";
    details = error.keyValue;
  }

  if (error.name === "MulterError") {
    statusCode = 400;
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the 5MB size limit"
        : error.message;
  }

  response.status(statusCode).json({
    message,
    ...(details !== undefined && { details }),
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
}

module.exports = { notFound, errorHandler };
