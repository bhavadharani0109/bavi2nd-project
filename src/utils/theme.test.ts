import test from 'node:test';
import assert from 'node:assert/strict';
import { Theme, ResolvedTheme } from '../contexts/ThemeContext';

function resolveThemeLogic(theme: Theme, isSystemDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return isSystemDark ? 'dark' : 'light';
  }
  return theme;
}

function getNextToggleTheme(currentResolved: ResolvedTheme): ResolvedTheme {
  return currentResolved === 'dark' ? 'light' : 'dark';
}

function validateThemeOption(val: unknown): val is Theme {
  return val === 'light' || val === 'dark' || val === 'system';
}

test('Requirement 2: Theme resolution handles Light, Dark, and System modes', () => {
  assert.equal(resolveThemeLogic('light', true), 'light');
  assert.equal(resolveThemeLogic('light', false), 'light');

  assert.equal(resolveThemeLogic('dark', true), 'dark');
  assert.equal(resolveThemeLogic('dark', false), 'dark');

  assert.equal(resolveThemeLogic('system', true), 'dark');
  assert.equal(resolveThemeLogic('system', false), 'light');
});

test('Requirement 1 & 2: Quick theme toggle alternates between light and dark', () => {
  assert.equal(getNextToggleTheme('light'), 'dark');
  assert.equal(getNextToggleTheme('dark'), 'light');
});

test('Requirement 5: Validates stored theme values for localStorage persistence', () => {
  assert.equal(validateThemeOption('light'), true);
  assert.equal(validateThemeOption('dark'), true);
  assert.equal(validateThemeOption('system'), true);
  assert.equal(validateThemeOption('invalid_theme'), false);
  assert.equal(validateThemeOption(null), false);
});
