import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import { App } from "./App";
import "./styles.css";
import "./gift-sites.css";

document.documentElement.dataset.pookletApp = "ready";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Pooklet root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
