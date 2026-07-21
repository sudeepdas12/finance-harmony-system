import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <ModuleStub
      title="Reports"
      description="Charts, aging reports, and Excel/PDF exports for all payables."
      phase="Phase 5"
    />
  ),
});
