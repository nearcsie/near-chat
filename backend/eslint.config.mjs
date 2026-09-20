import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Runtime logs must go through `utils/logger`: only that path tees into
      // the `recentLogs` ring buffer that `GET /api/v1/admin/logs` serves, and
      // only that path applies the `REDACTED_PATHS` scrubbing. The two
      // deliberate exceptions carry an inline disable stating their reason.
      "no-console": "error",
    },
  },
  {
    // Operator-facing CLIs, not the server runtime. `migrate:up`/`migrate:down`/
    // `migrate:create`/`db:seed` and the smoke and test runners are invoked
    // directly by `bun`, and stdout is their actual output channel. `migrate.ts`
    // in particular has to report when the application cannot boot at all.
    files: ["src/models/migrate.ts", "src/models/seed.ts", "scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
];
