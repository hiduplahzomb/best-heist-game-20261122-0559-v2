// The alarm meter: the game's heartbeat. Cameras and sightings push it up,
// quiet play lets it cool down, and at 100 the museum locks down — thirty
// seconds to reach the exit or the response team takes the thief down.

import { ALARM } from './config.js';

export function createAlarm() {
  return { value: 0, max: 0, lockdown: false, lockdownTimer: 0 };
}

export function updateAlarm(alarm, dt, context) {
  // context: { anySeen, getaway }
  if (context.getaway) {
    alarm.value = Math.min(100, alarm.value + ALARM.getawayRise * dt);
  }
  alarm.max = Math.max(alarm.max, alarm.value);

  // Lockdown triggers the moment the meter hits 100 — before any decay.
  if (alarm.value >= ALARM.lockdownAt && !alarm.lockdown) {
    alarm.lockdown = true;
    alarm.lockdownTimer = ALARM.lockdownTime;
    return 'lockdown';
  }
  if (!context.anySeen && !context.getaway && !alarm.lockdown) {
    alarm.value = Math.max(0, alarm.value - ALARM.decayRate * dt);
  }
  if (alarm.lockdown) {
    alarm.lockdownTimer -= dt;
    if (alarm.lockdownTimer <= 0) return 'lockdownExpired';
  }
  return null;
}

// Attach the add() helper to a plain alarm object.
export function bindAlarm(alarm) {
  alarm.add = (n) => {
    alarm.value = Math.min(100, alarm.value + n);
    alarm.max = Math.max(alarm.max, alarm.value);
  };
  return alarm;
}
