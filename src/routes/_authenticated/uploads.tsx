import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/uploads")({
  component: () => (
    <ModuleStub
      title="Uploads"
      description="History of bulk Excel/CSV uploads across companies, clients, and payables."
      phase="Phase 5"
    />
  ),
});
