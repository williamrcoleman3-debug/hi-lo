import { createContext, useContext } from "react";
import { THEMES, getTheme } from "./registry.js";

const ThemeContext = createContext(THEMES[0].tokens);

export function ThemeProvider({ themeId, children }) {
  return <ThemeContext.Provider value={getTheme(themeId).tokens}>{children}</ThemeContext.Provider>;
}

// Named to read like the old `import { C } from "../theme"` at call sites:
// `const C = useThemeTokens();`
export function useThemeTokens() {
  return useContext(ThemeContext);
}
