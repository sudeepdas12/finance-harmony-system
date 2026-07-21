import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: () => (
    <ModuleStub
      title="Pending Approvals"
      description="Maker/checker workflow — admins review changes requested by operators."
      phase="Phase 5"
    />
  ),
});
