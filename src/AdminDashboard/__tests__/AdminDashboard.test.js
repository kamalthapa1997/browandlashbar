import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
jest.mock(
  "react-router-dom",
  () => require("../../testUtils/reactRouterDomMock"),
  { virtual: true },
);
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "../AdminDashboard";
import { getGallery } from "../../api/galleryService";
import { getAdminFaqs } from "../../api/faqService";
import { getSettings, updateSettings } from "../../api/settingsService";

jest.mock("../../api/authService", () => ({ logoutAdmin: jest.fn() }));
jest.mock("../../api/galleryService", () => ({ getGallery: jest.fn() }));
jest.mock("../../api/faqService", () => ({ getAdminFaqs: jest.fn() }));
jest.mock("../../api/settingsService", () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
}));

const settings = {
  businessName: "Mero Brow & Lash Bar",
  contactPhone: "555-0100",
  businessEmail: "hello@example.com",
  streetAddress: "123 Main Street",
  suiteNumber: "",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  homepageOfferLink: "",
  homepageOffer: "",
};

function renderDashboard(onSettingsUpdated = jest.fn()) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminDashboard onSettingsUpdated={onSettingsUpdated} />
    </MemoryRouter>,
  );
}

async function loadDashboard() {
  await screen.findByText("Everything is looking polished.");
}

function dashboardNavigation() {
  return within(
    screen.getByRole("navigation", { name: "Dashboard sections" }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getGallery.mockResolvedValue([]);
  getAdminFaqs.mockResolvedValue([]);
  getSettings.mockResolvedValue(settings);
});

test("loads dashboard data and renders the overview", async () => {
  let resolveGallery;
  getGallery.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveGallery = resolve;
      }),
  );

  renderDashboard();

  expect(screen.getByText("Loading your dashboard…")).toBeInTheDocument();

  resolveGallery([]);

  await loadDashboard();
  expect(screen.getByText("Mero Brow & Lash Bar")).toBeInTheDocument();
  expect(getGallery).toHaveBeenCalledTimes(1);
  expect(getAdminFaqs).toHaveBeenCalledTimes(1);
  expect(getSettings).toHaveBeenCalledTimes(1);
});

test("shows the existing load error and retries successfully", async () => {
  getGallery.mockRejectedValueOnce(new Error("Unable to reach gallery"));

  renderDashboard();

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent("Unable to reach gallery");

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  await loadDashboard();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getGallery).toHaveBeenCalledTimes(2);
});

test("propagates saved settings through the existing callback", async () => {
  const onSettingsUpdated = jest.fn();
  const savedSettings = { ...settings, businessName: "Updated Brow Bar" };
  updateSettings.mockResolvedValue(savedSettings);

  renderDashboard(onSettingsUpdated);
  await loadDashboard();

  await userEvent.click(
    dashboardNavigation().getByRole("button", { name: /Settings$/ }),
  );
  const businessName = screen.getByLabelText("Business name");
  await userEvent.clear(businessName);
  await userEvent.type(businessName, "Updated Brow Bar");
  await userEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
  expect(updateSettings.mock.calls[0][0].get("businessName")).toBe(
    "Updated Brow Bar",
  );
  expect(onSettingsUpdated).toHaveBeenCalledWith(savedSettings);
});
