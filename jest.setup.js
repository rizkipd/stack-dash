/* eslint-env jest */

/**
 * Jest setup.
 *
 * AsyncStorage is a native module, so importing `src/storage/*` in a Node test
 * environment throws "NativeModule: AsyncStorage is null". The package ships an
 * official in-memory mock; registering it here keeps the storage modules
 * importable from pure-logic tests without each test file mocking it.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
