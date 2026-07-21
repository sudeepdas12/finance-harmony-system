import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/companies")({
  component: () => (
    <ModuleStub
      title="Companies"
      description="Master list of issuing companies (debentures & stocks)."
      phase="Phase 2"
    />
  ),
});
