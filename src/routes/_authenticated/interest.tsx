import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/interest")({
  component: () => (
    <ModuleStub
      title="Debenture Interest Payables"
      description="Track debenture interest with auto tax calculation, filters, and bulk upload."
      phase="Phase 3"
    />
  ),
});
