
// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: [
      "test/**/*.test.ts", // ignore test files in 'test' directory
      "test/**/*.spec.ts", // ignore test files in 'test' directory
      "src/**/*.test.ts", // ignore test files
      "dist/", // Ignore the entire 'dist' directory
      "build/", // Ignore the entire 'build' directory
      "lib/", // Ignore entire 'lib' directory
      "node_modules/", // Typically ignored by default, but good to be explicit
      "coverage/", // Ignore test coverage reports
      "**/*.d.ts", // Ignore all TypeScript declaration files
      ".config/*.js", // Ignore specific JS config files
      "custom-ignore-file.js", // Ignore a specific file
    ],
  }
);
