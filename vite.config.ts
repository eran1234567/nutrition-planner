import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
   host: "::",
    port: 8080,
    allowedHosts: [
      '.ngrok-free.app' // This dot at the start allows ANY ngrok URL
    ]
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
