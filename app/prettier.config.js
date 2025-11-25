module.exports = {
  tabWidth: 2,
  printWidth: 120,
  semi: true,
  singleQuote: false,
  bracketSameLine: true,
  trailingComma: "all",
  plugins: [
    require.resolve("@ianvs/prettier-plugin-sort-imports"),
    require.resolve("prettier-plugin-tailwindcss"), // must be at the end
  ],
  tailwindAttributes: ["style"],
  tailwindFunctions: ["tw", "tw.color", "tw.style"],
  importOrder: ["^react", "^@(react|(.+)/react)", "^expo", "<THIRD_PARTY_MODULES>", "", "^~/(.*)$", "", "^[./]"],
};
