import { render, screen } from "@testing-library/react";
jest.mock(
  "react-router-dom",
  () => require("../testUtils/reactRouterDomMock"),
  { virtual: true },
);
jest.mock("framer-motion", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get: (_, element) =>
        React.forwardRef(({ children, ...props }, ref) => {
          delete props.animate;
          delete props.exit;
          delete props.initial;
          delete props.transition;
          return React.createElement(element, { ...props, ref }, children);
        }),
    },
  );

  return {
    AnimatePresence: ({ children }) => children,
    motion,
    useReducedMotion: () => false,
  };
});
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { getCurrentAdmin } from "../api/authService";
import { getServices } from "../api/serviceService";
import { getGallery } from "../api/galleryService";
import { getAdminFaqs } from "../api/faqService";
import { getSettings } from "../api/settingsService";

jest.mock("../api/authService", () => ({
  getCurrentAdmin: jest.fn(),
  loginAdmin: jest.fn(),
  logoutAdmin: jest.fn(),
}));
jest.mock("../api/serviceService", () => ({ getServices: jest.fn() }));
jest.mock("../api/galleryService", () => ({ getGallery: jest.fn() }));
jest.mock("../api/faqService", () => ({ getAdminFaqs: jest.fn() }));
jest.mock("../api/settingsService", () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    addListener: () => {},
    removeEventListener: () => {},
    removeListener: () => {},
  });
  window.scrollTo = () => {};
  getServices.mockResolvedValue({});
  getGallery.mockResolvedValue([]);
  getAdminFaqs.mockResolvedValue([]);
  getSettings.mockResolvedValue({ businessName: "Mero Brow & Lash Bar" });
});

test("renders the protected dashboard for an authenticated admin", async () => {
  getCurrentAdmin.mockResolvedValue({ authenticated: true });

  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <App />
    </MemoryRouter>,
  );

  expect(
    await screen.findByText("Everything is looking polished."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Admin Login")).not.toBeInTheDocument();
});

test("redirects an unauthenticated admin route to the existing login screen", async () => {
  getCurrentAdmin.mockResolvedValue({ authenticated: false });

  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <App />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole("heading", { name: "Admin Login" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Everything is looking polished."),
  ).not.toBeInTheDocument();
});
