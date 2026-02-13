import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 80,
    // Using true here ensures the final published .replit.app URL
    // works automatically without you having to come back and edit this file.
    allowedHosts: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
  resolve: {
    // IMPORTANT: order matters. The more specific alias MUST come before "@",
    // otherwise "@" will match first and Vite will load the auto-generated
    // client.ts (which crashes if env injection fails).
    alias: [
      {
        find: "@/integrations/supabase/client",
        replacement: path.resolve(
          __dirname,
          "./src/integrations/supabase/client-runtime.ts",
        ),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
}));
