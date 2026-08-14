const STATUS_ERRORS = {
  400: ["Validation Error", "Please check the submitted fields."],
  401: ["Unauthorized", "Authentication is required."],
  403: ["Forbidden", "You do not have permission to perform this action."],
  404: ["Not Found", "The requested resource could not be found."],
  409: ["Conflict", "This resource already exists."],
  422: ["Validation Error", "Please check the submitted fields."],
  429: ["Too Many Requests", "Please wait before trying again."],
  500: ["Server Error", "Something went wrong on the server."],
};

class ApiError extends Error {
  constructor({ status, code, title, message, details }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.title = title;
    this.details = details;
  }
}

function getResponseError(data) {
  if (!data || typeof data !== "object") return {};

  return data.error && typeof data.error === "object" ? data.error : data;
}

function createApiError(status, data) {
  const responseError = getResponseError(data);
  const [title, fallbackMessage] = STATUS_ERRORS[status] || [
    status >= 500 ? "Server Error" : "Request Error",
    status >= 500
      ? "Something went wrong on the server."
      : "The request could not be completed.",
  ];

  return new ApiError({
    status,
    code: responseError.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED"),
    title,
    message:
      status < 500 && typeof responseError.message === "string"
        ? responseError.message
        : fallbackMessage,
    details: responseError.details,
  });
}

function createNetworkError() {
  return new ApiError({
    code: "NETWORK_ERROR",
    title: "Network Error",
    message: "Unable to connect to the server.",
  });
}

function logApiError(error) {
  console.error(`${error.title}: ${error.message}`);
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      title: "Server Error",
      message: "The server returned an invalid response.",
    });
  }
}

async function request(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      credentials: "include",
    });
    const data = await readResponseBody(response);

    if (!response.ok) {
      throw createApiError(response.status, data);
    }

    return data;
  } catch (error) {
    const apiError = error instanceof ApiError ? error : createNetworkError();
    logApiError(apiError);
    throw apiError;
  }
}

export function apiRequest(path, options = {}) {
  return request(path, options);
}

let authenticationFailureReported = false;

export function resetAuthenticationFailure() {
  authenticationFailureReported = false;
}

export async function authenticatedApiRequest(path, options = {}) {
  try {
    return await request(path, options);
  } catch (error) {
    if (
      !authenticationFailureReported &&
      (error.status === 401 || error.status === 403)
    ) {
      authenticationFailureReported = true;

      window.dispatchEvent(
        new CustomEvent("admin-auth-failed", {
          detail: { status: error.status },
        }),
      );
    }

    throw error;
  }
}
