import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getCurrentAdmin, loginAdmin } from "../api/authService";

const AuthContext = createContext(null);

function AuthProvider({ checkSession = true, children }) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!checkSession) return undefined;

    let isMounted = true;

    getCurrentAdmin()
      .then((session) => {
        if (isMounted) setIsAuthenticated(Boolean(session?.authenticated));
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, checkSession]);

  function login(credentials) {
    return loginAdmin(credentials);
  }

  return (
    <AuthContext.Provider value={{ isChecking, isAuthenticated, login }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

export { AuthProvider, useAuth };
