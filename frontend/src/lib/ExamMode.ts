// src/lib/ExamMode.ts
// Small module that returns exam mode handlers bound to callbacks.
// Usage: const handlers = createExamModeHandlers({ submitAll, pushToast });
// handlers.enable(); handlers.disable(); handlers.cleanup();

type Callbacks = {
  submitAll: () => Promise<void> | void;
  pushToast: (text: string, kind?: "info" | "error" | "success", ms?: number) => void;
};

export function createExamModeHandlers(cb: Callbacks) {
  let examModeActive = false;

  function beforeUnloadHandler(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = "Exam in progress. Are you sure you want to leave? Your answers may be lost.";
    return e.returnValue;
  }

  async function fullscreenChangeHandler() {
    // if examMode active but fullscreen lost
    if (examModeActive && !document.fullscreenElement) {
      // Ask user: do you want to terminate exam?
      const ok = window.confirm("You left fullscreen during an exam. Do you want to terminate and submit the exam? (OK = submit, Cancel = return to exam)");
      if (ok) {
        try {
          await cb.submitAll();
        } catch (e) {
          cb.pushToast("Submit failed during exam exit", "error");
        }
      } else {
        // try to re-enter fullscreen
        document.documentElement.requestFullscreen().catch(() => {
          cb.pushToast("Unable to re-enter fullscreen — please re-enable and continue or submit.", "error");
        });
      }
    }
  }

  function enable() {
    examModeActive = true;
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    window.addEventListener("beforeunload", beforeUnloadHandler);
    document.addEventListener("fullscreenchange", fullscreenChangeHandler);
  }

  function disable() {
    examModeActive = false;
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    document.removeEventListener("fullscreenchange", fullscreenChangeHandler);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // cleanup if component unmounts
  function cleanup() {
    disable();
  }

  return { enable, disable, cleanup };
}
