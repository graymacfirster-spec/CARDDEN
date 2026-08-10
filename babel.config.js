module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-injects react-native-worklets/plugin when the
    // package is present, which Reanimated 4 requires.
    presets: ['babel-preset-expo'],
  };
};
