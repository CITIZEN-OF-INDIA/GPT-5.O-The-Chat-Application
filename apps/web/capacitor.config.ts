import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.systemFiles.systemfiles",
  appName: "system files",
  webDir: "dist",
  server: {
    cleartext: true,
    allowNavigation: ["gpt-5-o-the-chat-application.onrender.com"],
  },
};

export default config;
