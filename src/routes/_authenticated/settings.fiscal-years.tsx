import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/settings/fiscal-years")({
  component: () => (
    <ModuleStub
      title="Fiscal Year Settings"
      description="Define fiscal year windows used across dividend and reporting modules."
      phase="Phase 5"
    />
  ),
});
