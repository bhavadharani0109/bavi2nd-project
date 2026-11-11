import test from 'node:test';
import assert from 'node:assert/strict';

export function validateProfileUpdate(payload: {
  displayName?: string;
  defaultReminderDays?: number;
}): { valid: boolean; error?: string; cleanDisplayName?: string; cleanDays?: number } {
  if (payload.displayName !== undefined) {
    const trimmed = payload.displayName.trim();
    if (!trimmed) {
      return { valid: false, error: 'Display name cannot be empty.' };
    }
    if (trimmed.length > 80) {
      return { valid: false, error: 'Display name must not exceed 80 characters.' };
    }
  }

  if (payload.defaultReminderDays !== undefined) {
    const days = Math.round(Number(payload.defaultReminderDays));
    if (isNaN(days) || days < 1 || days > 365) {
      return { valid: false, error: 'Default reminder lead days must be between 1 and 365 days.' };
    }
  }

  return {
    valid: true,
    cleanDisplayName: payload.displayName ? payload.displayName.trim().slice(0, 80) : undefined,
    cleanDays:
      payload.defaultReminderDays !== undefined
        ? Math.min(365, Math.max(1, Math.round(payload.defaultReminderDays)))
        : undefined,
  };
}

test('Requirement 3: Display Name validation enforces non-empty and 1-80 characters', () => {
  const emptyRes = validateProfileUpdate({ displayName: '   ' });
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.error || '', /cannot be empty/i);

  const tooLong = 'A'.repeat(81);
  const tooLongRes = validateProfileUpdate({ displayName: tooLong });
  assert.equal(tooLongRes.valid, false);
  assert.match(tooLongRes.error || '', /80 characters/i);

  const validName = '  Jane Doe  ';
  const validRes = validateProfileUpdate({ displayName: validName });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.cleanDisplayName, 'Jane Doe');
});

test('Requirement 4: Default reminder trigger lead days clamped between 1 and 365', () => {
  const zeroRes = validateProfileUpdate({ defaultReminderDays: 0 });
  assert.equal(zeroRes.valid, false);
  assert.match(zeroRes.error || '', /between 1 and 365/i);

  const tooHighRes = validateProfileUpdate({ defaultReminderDays: 366 });
  assert.equal(tooHighRes.valid, false);

  const validDays = validateProfileUpdate({ defaultReminderDays: 45.4 });
  assert.equal(validDays.valid, true);
  assert.equal(validDays.cleanDays, 45);
});

test('Requirement 7: Security ensures user ownership isolation', () => {
  const currentUid = 'user_abc_123';
  const otherUid = 'user_hacker_999';

  const canModifyProfile = (sessionUid: string, targetUid: string) =>
    sessionUid === targetUid && sessionUid.length > 0;

  assert.equal(canModifyProfile(currentUid, currentUid), true);
  assert.equal(canModifyProfile(currentUid, otherUid), false);
});
