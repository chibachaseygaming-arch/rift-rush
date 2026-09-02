import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RiftRush from "../app/rift-rush";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Rift Rush could not find its page root.");
}

createRoot(root).render(
  <StrictMode>
    <RiftRush />
  </StrictMode>,
);
