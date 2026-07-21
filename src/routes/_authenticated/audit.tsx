import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/audit")({
  component: () => (
    <ModuleStub
      title="Audit Log"
      description="Immutable history of every write across the system (admin & auditor only)."
      phase="Phase 6"
    />
  ),
});
