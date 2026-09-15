import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("terrages-theme", theme);
    } catch {
      /* Browser storage can be disabled. */
    }
  }, [theme]);
  const label = `Ativar modo ${theme === "light" ? "escuro" : "claro"}`;
  return (
    <button
      type="button"
      className="tg-icon-button"
      title={label}
      aria-label={label}
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
    >
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  );
};
