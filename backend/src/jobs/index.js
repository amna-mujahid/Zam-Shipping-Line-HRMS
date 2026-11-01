// Background jobs, started once MySQL is reachable.
import { autoMarkAbsent } from './autoAbsent.job.js';

const AUTO_ABSENT_EVERY_MS = 10 * 60 * 1000;

export const startJobs = () => {
  const run = () =>
    autoMarkAbsent()
      .then((n) => n && console.log(`  [auto-absent] marked ${n} day(s) Absent`))
      .catch((err) => console.error('  [auto-absent] failed:', err.message));
  run();
  return setInterval(run, AUTO_ABSENT_EVERY_MS);
};
