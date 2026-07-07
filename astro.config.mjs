import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";

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
          items: [
            {
              label: "Power BI",
              items: [
                {
                  autogenerate: {
                    directory: "fabric/power-bi",
                  },
                },
              ],
            },
            {
              label: "Notebooks",
              items: [
                {
                  autogenerate: {
                    directory: "fabric/notebooks",
                  },
                },
              ],
            },
          ],
        },
        {
          label: "Azure",
          items: [
            {
              autogenerate: {
                directory: "azure",
              },
            },
          ],
        },
        {
          label: "Windows",
          items: [
            {
              autogenerate: {
                directory: "windows",
              },
            },
          ],
        },
        {
          label: "Captures",
          items: [
            {
              autogenerate: {
                directory: "captures",
              },
            },
          ],
        },
      ],

      customCss: [
        // Path to your Tailwind base styles:
        './src/styles/global.css',
      ],
      components: {
        Head: './src/components/Head.astro',
      },
    }),
    // tailwind({
    //   applyBaseStyles: false,
    // }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
