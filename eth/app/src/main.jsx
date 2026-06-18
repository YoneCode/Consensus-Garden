import React from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App.jsx";

const APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

createRoot(document.getElementById("root")).render(
  <PrivyProvider
    appId={APP_ID}
    config={{
      loginMethods: ["wallet", "github"],
      appearance: { theme: "dark", accentColor: "#2f9e54", logo: undefined },
      embeddedWallets: { createOnLogin: "off" },
    }}
  >
    <App />
  </PrivyProvider>
);
