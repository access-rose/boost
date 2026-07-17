module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  overrides: [
    {
      env: {
        node: true
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script"
      }
    },
    {
      // Scoped to *.ts so the .js tests and config files keep their existing
      // treatment. The type-checked presets and the escape-hatch bans
      // (no-explicit-any, no-non-null-assertion, no-unsafe-type-assertion) are
      // switched on once every file is annotated -- until then they would
      // flood on not-yet-typed sources.
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname
      },
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "no-unused-vars": "off",
        // caughtErrorsIgnorePattern keeps `catch (_)` allowed, as it was under
        // eslint's own no-unused-vars; typescript-eslint v8 defaults
        // caughtErrors to "all".
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "_*", caughtErrorsIgnorePattern: "^_" }
        ],
        // `a() || b()` for side effects is deliberate style in visit.ts
        "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true }],
        // false-positives on a type-only import alongside a value import
        "no-duplicate-imports": "off",
        // `import()` types must stay allowed: globals.d.ts augments the global
        // scope, so it cannot carry a top-level import.
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports", disallowTypeAnnotations: false }
        ]
      }
    }
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "comma-dangle": "error",
    "curly": ["error", "multi-line"],
    "getter-return": "off",
    "no-console": "off",
    "no-duplicate-imports": ["error"],
    "no-multi-spaces": ["error", { "exceptions": { "VariableDeclarator": true }}],
    "no-multiple-empty-lines": ["error", { "max": 2 }],
    "no-self-assign": ["error", { "props": false }],
    "no-trailing-spaces": ["error"],
    "no-unused-vars": ["error", { argsIgnorePattern: "_*" }],
    "no-useless-escape": "off",
    "no-var": ["error"],
    "prefer-const": ["error"],
    "semi": ["error", "never"]
  },
  globals: {
    test: true,
    setup: true
  }
}
