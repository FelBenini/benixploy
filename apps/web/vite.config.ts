import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  ssr: {
    // LayerChart v2 ships raw .svelte components in its dist; Node can't
    // import them at runtime, so Vite must compile them for SSR.
    noExternal: ["layerchart"],
  },
});
