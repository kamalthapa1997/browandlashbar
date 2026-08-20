import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getSettings } from "../api/settingsService";

const SettingsContext = createContext(null);

function SettingsProvider({ children }) {
  const location = useLocation();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return undefined;

    let isCurrent = true;

    async function loadSettings() {
      try {
        const data = await getSettings();
        if (isCurrent) setSettings(data);
      } catch {
        if (isCurrent) setSettings(null);
      }
    }

    loadSettings();

    return () => {
      isCurrent = false;
    };
  }, [location.pathname]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

function useSettings() {
  return useContext(SettingsContext);
}

export { SettingsProvider, useSettings };
