const React = require("react");

const RouterContext = React.createContext({
  location: { pathname: "/", hash: "", state: null },
  navigate: () => {},
});

function toLocation(path, state = null) {
  const [pathname, hash = ""] = path.split("#");
  return { pathname, hash: hash ? `#${hash}` : "", state };
}

function MemoryRouter({ initialEntries = ["/"], children }) {
  const [location, setLocation] = React.useState(() =>
    toLocation(initialEntries[0]),
  );
  const navigate = React.useCallback((path, options = {}) => {
    setLocation(toLocation(path, options.state || null));
  }, []);

  return React.createElement(
    RouterContext.Provider,
    { value: { location, navigate } },
    children,
  );
}

function useLocation() {
  return React.useContext(RouterContext).location;
}

function useNavigate() {
  return React.useContext(RouterContext).navigate;
}

function matchesPath(path, pathname) {
  if (path === "*") return true;
  if (path.endsWith("/*")) {
    const basePath = path.slice(0, -2);
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  }
  return path === pathname;
}

function Routes({ children, location: providedLocation }) {
  const context = React.useContext(RouterContext);
  const location = providedLocation || context.location;
  const route = React.Children.toArray(children).find((child) =>
    matchesPath(child.props.path, location.pathname),
  );

  return route ? route.props.element : null;
}

function Route() {
  return null;
}

function Navigate({ to, state, replace }) {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate(to, { state, replace });
  }, [navigate, replace, state, to]);

  return null;
}

function Link({ to, children, ...props }) {
  const navigate = useNavigate();

  return React.createElement(
    "a",
    {
      ...props,
      href: to,
      onClick: (event) => {
        event.preventDefault();
        navigate(to);
      },
    },
    children,
  );
}

function NavLink({ to, children, className, ...props }) {
  const location = useLocation();
  const resolvedClassName =
    typeof className === "function"
      ? className({ isActive: location.pathname === to })
      : className;

  return React.createElement(Link, { ...props, to, className: resolvedClassName }, children);
}

module.exports = {
  Link,
  MemoryRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
};
