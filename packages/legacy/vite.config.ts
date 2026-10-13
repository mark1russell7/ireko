import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The old Jqy playground. It stays until the new core reaches parity (docs/REVIEW.md, phase P2).
export default defineConfig({
  plugins: [react()],
});
