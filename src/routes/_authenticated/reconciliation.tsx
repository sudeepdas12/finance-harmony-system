import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/reconciliation")({
  component: () => (
    <ModuleStub
      title="Bank Reconciliation"
      description="Upload bank statements and auto-match to interest & dividend payables."
      phase="Phase 5"
    />
  ),
});
