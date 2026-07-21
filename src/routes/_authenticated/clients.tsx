import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/clients")({
  component: () => (
    <ModuleStub
      title="Clients / Shareholders"
      description="Master list of shareholders and debenture holders (with BOID lookup)."
      phase="Phase 2"
    />
  ),
});
