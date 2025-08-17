import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Vite exposes environment variables on import.meta.env in the build.
// Use a fallback of '/' when VITE_BASE isn't provided.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta: any = import.meta;
const base = (meta.env && meta.env.VITE_BASE) || '/';

export default defineConfig({
  plugins: [react()],
  base,
});
