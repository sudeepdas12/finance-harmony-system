import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/allocations")({
  component: () => (
    <ModuleStub
      title="IAF Allocations"
      description="Allocate & track Investor Awareness Fund contributions per company & fiscal year."
      phase="Phase 5"
    />
  ),
});
