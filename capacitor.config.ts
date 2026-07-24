import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.nobretransportadora.sgf",
  appName: "SGF Nobre Motorista",
  webDir: "public",
  server: {
    url: "https://sgf-nobre-2-ux1b.vercel.app/motorista",
    cleartext: false,
    allowNavigation: ["sgf-nobre-2-ux1b.vercel.app"],
  },
  android: {
    useLegacyBridge: true,
  },
};

export default config;
