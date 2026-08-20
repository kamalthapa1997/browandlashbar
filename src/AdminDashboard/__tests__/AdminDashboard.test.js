import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
jest.mock(
  "react-router-dom",
  () => require("../../testUtils/reactRouterDomMock"),
  { virtual: true },
);
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "../AdminDashboard";
import {
  createService,
  deleteService,
  getServices,
} from "../../api/serviceService";
import { getGallery } from "../../api/galleryService";
import { getAdminFaqs } from "../../api/faqService";
import { getSettings, updateSettings } from "../../api/settingsService";

jest.mock("../../api/authService", () => ({ logoutAdmin: jest.fn() }));
jest.mock("../../api/serviceService", () => ({
  getServices: jest.fn(),
  createService: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
}));
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

const services = {
  Threading: [
    {
      _id: "service-1",
      name: "Brow Shape",
      price: 20,
      category: "Threading",
    },
  ],
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
  getServices.mockResolvedValue(services);
  getGallery.mockResolvedValue([]);
  getAdminFaqs.mockResolvedValue([]);
  getSettings.mockResolvedValue(settings);
});

test("loads dashboard data and renders the overview", async () => {
  let resolveServices;
  getServices.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveServices = resolve;
      }),
  );

  renderDashboard();

  expect(screen.getByText("Loading your dashboard…")).toBeInTheDocument();

  resolveServices(services);

  await loadDashboard();
  expect(screen.getByText("Mero Brow & Lash Bar")).toBeInTheDocument();
  expect(getGallery).toHaveBeenCalledTimes(1);
  expect(getAdminFaqs).toHaveBeenCalledTimes(1);
  expect(getSettings).toHaveBeenCalledTimes(1);
});

test("shows the existing load error and retries successfully", async () => {
  getServices.mockRejectedValueOnce(new Error("Unable to reach services"));

  renderDashboard();

  expect(
    await screen.findByRole("alert"),
  ).toHaveTextContent("Unable to reach services");

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  await loadDashboard();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getServices).toHaveBeenCalledTimes(2);
});

test("adds a saved service to the displayed service data once", async () => {
  const savedService = {
    _id: "service-2",
    name: "Brow Design",
    price: 30,
    category: "Threading",
  };
  createService.mockResolvedValue(savedService);

  renderDashboard();
  await loadDashboard();

  await userEvent.click(
    dashboardNavigation().getByRole("button", { name: /Services$/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: /Add service/i }));

  await userEvent.type(screen.getByLabelText("Service name"), "Brow Design");
  await userEvent.type(screen.getByLabelText("Price"), "30");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "Threading");
  await userEvent.click(screen.getByRole("button", { name: "Save service" }));

  expect(await screen.findByText("Brow Design")).toBeInTheDocument();
  expect(screen.getAllByText("Brow Design")).toHaveLength(1);
  expect(createService).toHaveBeenCalledWith({
    name: "Brow Design",
    price: "30",
    category: "Threading",
  });
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

test("requires confirmation before deleting a service and deletes once after confirmation", async () => {
  deleteService.mockResolvedValue({});

  renderDashboard();
  await loadDashboard();

  await userEvent.click(
    dashboardNavigation().getByRole("button", { name: /Services$/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));

  expect(
    await screen.findByRole("heading", { name: "Delete service?" }),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(deleteService).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(screen.getByRole("button", { name: "Yes, Delete" }));

  await waitFor(() => expect(deleteService).toHaveBeenCalledTimes(1));
  expect(deleteService).toHaveBeenCalledWith("service-1");
  await waitFor(() =>
    expect(screen.queryByText("Brow Shape")).not.toBeInTheDocument(),
  );
});
