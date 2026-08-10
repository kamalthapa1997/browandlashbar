function getErrorMessage(data, fallback) {
  if (data && typeof data === "object") {
    return data.message || data.error || fallback;
  }

  return fallback;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  try {
    return await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    credentials: "include",
  });

  const data = await readResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(data, "The request could not be completed."),
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
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