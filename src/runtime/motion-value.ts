// Numeric adapter: the shared Motion boundary remains the sole frame clock.
import { motionLoop, reduced, durations, type MotionDocument } from "./motion";
export function transitionValue(
  update: (progress: number) => void,
  duration = durations.mapFocus,
  doc: MotionDocument = document,
) {
  if (reduced.matches || doc.hidden || duration <= 0) {
    update(1);
    return { stop() {} };
  }
  const started = performance.now();
  let stopped = false;
  const cleanup = () => {
    loop.destroy();
    doc.removeEventListener("visibilitychange", hidden);
  };
  const finish = () => {
    if (stopped) return;
    stopped = true;
    cleanup();
    update(1);
  };
  const loop = motionLoop(
    () => {
      const progress = Math.min(
        1,
        (performance.now() - started) / (duration * 1000),
      );
      if (progress >= 1) {
        finish();
        return false;
      }
      update(1 - (1 - progress) ** 3);
    },
    finish,
    doc,
  );
  const hidden = () => {
    if (doc.hidden) finish();
  };
  doc.addEventListener("visibilitychange", hidden);
  loop.start();
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cleanup();
    },
  };
}
