async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "The request could not be completed.",
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function apiRequest(path, options = {}) {
  return request(path, options);
}

export async function authenticatedApiRequest(path, options = {}) {
  try {
    return await request(path, options);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.dispatchEvent(
        new CustomEvent("admin-auth-failed", { detail: { status: error.status } }),
      );
    }
    throw error;
  }
}
