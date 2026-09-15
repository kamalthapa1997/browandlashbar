function normalizedName(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Square item names identify services. A variation is included only when the
 * customer is choosing between multiple variations of that item.
 */
export function formatServiceIdentity(
  serviceName,
  variationName,
  hasVariationChoice = false,
) {
  const itemName = normalizedName(serviceName);
  const detail = normalizedName(variationName);

  if (itemName && hasVariationChoice && detail) {
    return `${itemName} — ${detail}`;
  }

  return itemName || detail || "Select service";
}

export function getSelectedServiceIdentity(variation) {
  return (
    normalizedName(variation?.displayName) ||
    formatServiceIdentity(
      variation?.serviceName,
      variation?.name,
      variation?.hasVariationChoice,
    )
  );
}
