import { fireEvent, render, screen } from "@testing-library/react";
import Treatmentnavlists from "./Treatmentnavlists";
import { getSquareMenuServices } from "../api/squareService";

jest.mock("../api/squareService", () => ({
  getSquareMenuServices: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders Square menu data with the existing accordion classes and price format", async () => {
  getSquareMenuServices.mockResolvedValue({
    categories: [{
      id: "brows",
      name: "Brows",
      services: [{ id: "variation-1", variationId: "variation-1", name: "Brow Shape", price: 75 }],
    }],
  });

  render(<Treatmentnavlists />);

  const header = await screen.findByRole("button", { name: /Brows/ });
  expect(header).toHaveClass("service-accordion__header");
  expect(screen.getByText("$75.00")).toBeInTheDocument();

  fireEvent.click(header);
  expect(header).toHaveAttribute("aria-expanded", "true");
  expect(header).toHaveClass("service-accordion__header--open");
});

test("uses the existing message styling for an empty Square menu", async () => {
  getSquareMenuServices.mockResolvedValue({ categories: [] });

  render(<Treatmentnavlists />);

  expect(
    await screen.findByText("No appointment services are available right now."),
  ).toHaveClass("service-accordion__error");
});
