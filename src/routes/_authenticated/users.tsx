import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/users")({
  component: () => (
    <ModuleStub
      title="Users & Roles"
      description="Assign admin, finance, reconciliation, auditor, and viewer roles. Admin only."
      phase="Phase 2"
    />
  ),
});
