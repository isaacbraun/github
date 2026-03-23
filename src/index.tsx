import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TeamList from "./components/TeamList";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <TeamList />
  </StrictMode>
);
