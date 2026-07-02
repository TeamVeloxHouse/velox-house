import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Windows ARM64 has no bundled Chrome Headless Shell — use the installed Edge.
Config.setBrowserExecutable(
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
);
// High-quality H.264 for the marketing site hero
Config.setCodec("h264");
Config.setCrf(18);
