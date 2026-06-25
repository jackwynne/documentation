import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";

import vercel from "@astrojs/vercel/serverless";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://documentation-zeta-nine.vercel.app",

  // output: "server",
  // adapter: vercel(),
  integrations: [
    starlight({
      title: "Docs",
      editLink: {
        baseUrl: "https://github.com/jackwynne/documentation/edit/main/",
      },
      lastUpdated: true,
      social: [
        { icon: 'github', label: 'GitHub', href: "https://github.com/jackwynne/documentation"},
      ],
      sidebar: [
        {
          label: "Microsoft Fabric",
          autogenerate: {
            directory: "powerbi",
          },
        },
        {
          label: "Azure",
          autogenerate: {
            directory: "azure",
          },
        },
        {
          label: "Windows",
          autogenerate: {
            directory: "windows",
          },
        },
      ],

      customCss: [
        // Path to your Tailwind base styles:
        './src/styles/global.css',
      ],
    }),
    // tailwind({
    //   applyBaseStyles: false,
    // }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
