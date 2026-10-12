"use client";

import { useEffect } from "react";
import { reportClientFailure } from "@/lib/client-observability";

export default function ClientObservability() {
  useEffect(() => {
    const onError = () => reportClientFailure({ category: "client_runtime_error", code: "window_error", surface: "browser" });
    const onRejected = () => reportClientFailure({ category: "client_runtime_error", code: "unhandled_promise_rejection", surface: "browser" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejected);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejected);
    };
  }, []);
  return null;
}
