import "@testing-library/jest-dom";

// Mock localStorage for tests (jsdom doesn't provide it by default in vitest)
const store = {};

global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => {
    store[key] = String(value);
  },
  removeItem: (key) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach(key => delete store[key]);
  }
};
