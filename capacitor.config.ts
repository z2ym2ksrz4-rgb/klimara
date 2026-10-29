import type { CapacitorConfig } from "@capacitor/cli";
import app from "./app.config.json";

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: "dist",
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notify",
      iconColor: app.brandColor,
    },
  },
};

export default config;
