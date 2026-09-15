import { getGalleryCategoryLabel } from "./galleryCategoryOptions";

test("uses category options supplied by the API", () => {
  expect(
    getGalleryCategoryLabel("facials", [{ value: "facials", label: "Facials" }]),
  ).toBe("Facials");
});

test("keeps unknown stored Gallery categories readable", () => {
  expect(getGalleryCategoryLabel("legacy_brows")).toBe("Legacy Brows");
});
