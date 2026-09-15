export function getGalleryCategoryLabel(category, options = []) {
  const matchingOption = options.find((option) => option.value === category);
  if (matchingOption) return matchingOption.label;

  if (typeof category !== "string" || !category.trim()) {
    return "Gallery image";
  }

  return category.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
