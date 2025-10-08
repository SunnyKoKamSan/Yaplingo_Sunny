const { defineConfig, globalIgnores } = require("eslint/config");
const configExpo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  configExpo,
  {
    rules: {
      // when importing `tw` from "twrnc" and using `tw.style` at the same time
      "import/no-named-as-default-member": "off",
    },
  },
  globalIgnores([".expo", "ios", "android"]),
]);
