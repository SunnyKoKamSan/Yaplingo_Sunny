const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.watcher = {
  watchman: {
    enabled: false,
  },
};

module.exports = config;
