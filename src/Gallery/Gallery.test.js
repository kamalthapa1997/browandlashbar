import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Gallery from "./Gallery";
import { getGallery, getGalleryCategories } from "../api/galleryService";

jest.mock("../api/galleryService", () => ({
  getGallery: jest.fn(),
  getGalleryCategories: jest.fn(),
}));

jest.mock("../contexts/SettingsContext", () => ({
  useSettings: () => ({ settings: null }),
}));

const galleryImages = [
  {
    _id: "featured",
    imageUrl: "https://example.com/featured.jpg",
    category: "lashes",
    caption: "Featured caption",
    featured: true,
    aspectRatio: 1.5,
  },
  {
    _id: "supporting",
    imageUrl: "https://example.com/supporting.jpg",
    category: "lashes",
    caption: "Supporting caption",
    aspectRatio: 1.2,
  },
];

beforeEach(() => {
  getGallery.mockResolvedValue(galleryImages);
  getGalleryCategories.mockResolvedValue([
    { id: "lashes", value: "lashes", label: "Lashes" },
  ]);
  const runAnimationFrame = (callback) => {
    return setTimeout(callback, 0);
  };
  window.requestAnimationFrame = runAnimationFrame;
  global.requestAnimationFrame = runAnimationFrame;
  window.cancelAnimationFrame = jest.fn();
  global.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {
      this.callback([{ contentRect: { width: 900 } }]);
    }

    disconnect() {}
  };
  global.Image = class {
    constructor() {
      this.naturalWidth = 900;
      this.naturalHeight = 600;
    }

    decode() {
      return Promise.resolve();
    }

    set src(_value) {
      Promise.resolve().then(() => this.onload?.());
    }
  };
});

test("shows captions in featured presentation and the lightbox, not supporting grid cards", async () => {
  render(<Gallery />);

  expect(await screen.findByText("Featured work")).toBeInTheDocument();
  expect(screen.getByText("Featured caption")).toBeInTheDocument();
  expect(screen.queryByText("Supporting caption")).not.toBeInTheDocument();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "View Lashes: Supporting caption",
    }),
  );

  await waitFor(() => {
    expect(screen.getByText("Supporting caption")).toBeInTheDocument();
  });
});
