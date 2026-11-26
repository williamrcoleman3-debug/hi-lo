import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("../components/AuthWidget", () => ({ AuthWidget: () => <div>SIGN-IN-WIDGET</div> }));
vi.mock("./TeammateGame.jsx", () => ({ default: () => <div>NAME-GAME</div> }));
vi.mock("../components/PrivacyPolicyScreen", () => ({ PrivacyPolicyScreen: () => <div>PRIVACY-SCREEN</div> }));
vi.mock("../components/DeleteAccountScreen", () => ({ DeleteAccountScreen: () => <div>DELETE-SCREEN</div> }));
vi.mock("../themes/ThemeContext", () => ({ useThemeTokens: () => ({}) }));

import { NameGameShell } from "./NameGameShell.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, el;
function render(props) {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<NameGameShell userId={null} profile={null} messages={MESSAGES} {...props} />));
  return el;
}
afterEach(() => { act(() => root.unmount()); el.remove(); });

const MESSAGES = {
  banner_signed_in: { content: "WELCOME-BANNER", updatedAt: "x" },
  tagline: { content: "HILO-TAGLINE", updatedAt: "x" },
};

describe("The Name Game home page", () => {
  it("shows the title, the game, and the Hi-Lo sign-in", () => {
    const t = render().textContent;
    expect(t).toContain("The Name Game");
    expect(t).toContain("NAME-GAME");
    expect(t).toContain("SIGN-IN-WIDGET");
  });
  it("hides the Hi-Lo welcome messages", () => {
    const t = render({ userId: "u1" }).textContent;
    expect(t).not.toContain("WELCOME-BANNER");
    expect(t).not.toContain("HILO-TAGLINE");
    expect(t).not.toContain("$25,000");
  });
  it("footer has only Privacy, Delete Account and the help email", () => {
    const f = render().querySelector("footer").textContent;
    expect(f).toContain("Privacy Policy");
    expect(f).toContain("Delete Account");
    expect(f).toContain("help@hi-lo-game.com");
    expect(f).not.toContain("Contest Rules");
  });
  it("footer links open the privacy and delete-account screens", () => {
    const root = render({ userId: "u1" });
    const btn = (label) => [...root.querySelectorAll("footer button")].find((b) => b.textContent === label);
    act(() => btn("Privacy Policy").click());
    expect(root.textContent).toContain("PRIVACY-SCREEN");
    act(() => btn("Delete Account").click());
    expect(root.textContent).toContain("DELETE-SCREEN");
  });
});
