async function request(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "The request could not be completed.",
    );
  }

  return data;
}

export function apiRequest(path, options = {}) {
  const token = localStorage.getItem("adminToken");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return request(path, { ...options, headers });
}
