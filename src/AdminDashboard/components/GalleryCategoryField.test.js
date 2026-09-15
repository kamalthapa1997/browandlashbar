import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GalleryCategoryField } from "./GalleryManager";
import { createGalleryCategory } from "../../api/galleryService";

jest.mock("../../api/galleryService", () => ({
  createGalleryCategory: jest.fn(),
  createGalleryItem: jest.fn(),
  deleteGalleryCategory: jest.fn(),
  deleteGalleryItem: jest.fn(),
  getGalleryCategories: jest.fn(),
  updateGalleryItem: jest.fn(),
}));

const options = [{ id: "lashes", value: "lashes", label: "Lashes" }];

function renderField(overrides = {}) {
  const props = {
    value: "lashes",
    options,
    loading: false,
    loadError: "",
    onChange: jest.fn(),
    onCategoriesChanged: jest.fn(() => Promise.resolve(options)),
    confirmAction: jest.fn(),
    notify: jest.fn(),
    ...overrides,
  };
  return { ...render(<GalleryCategoryField {...props} />), props };
}

test("creates a category through React state without nesting a native form", async () => {
  let resolveCreate;
  createGalleryCategory.mockImplementation(
    () => new Promise((resolve) => { resolveCreate = resolve; }),
  );
  const { container, props } = renderField({
    onCategoriesChanged: jest.fn(() => Promise.resolve([
      ...options,
      { id: "facials", value: "facials", label: "Facials" },
    ])),
  });

  fireEvent.click(screen.getByRole("button", { name: /add new category/i }));
  const input = screen.getByLabelText("New category name");
  fireEvent.change(input, { target: { value: "  Facials  " } });
  fireEvent.click(screen.getByRole("button", { name: "Create category" }));

  expect(container.querySelector(".admin-gallery__category-add-form form")).toBeNull();
  expect(createGalleryCategory).toHaveBeenCalledWith("Facials");
  expect(screen.getByRole("button", { name: /creating category/i })).toBeDisabled();

  resolveCreate({ id: "facials", value: "facials", label: "Facials" });
  await waitFor(() => expect(props.onChange).toHaveBeenCalledWith("facials"));
  expect(props.notify).toHaveBeenCalledWith("Gallery category created");
});

test("uses the same handler for Enter and preserves input after an API error", async () => {
  createGalleryCategory.mockRejectedValueOnce(new Error("Category already exists"));
  renderField();

  fireEvent.click(screen.getByRole("button", { name: /add new category/i }));
  const input = screen.getByLabelText("New category name");
  fireEvent.change(input, { target: { value: "Facials" } });
  fireEvent.keyDown(input, { key: "Enter" });

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Category already exists"));
  expect(input).toHaveValue("Facials");
  expect(createGalleryCategory).toHaveBeenCalledWith("Facials");
  expect(screen.getByRole("button", { name: "Create category" })).toBeEnabled();
});
