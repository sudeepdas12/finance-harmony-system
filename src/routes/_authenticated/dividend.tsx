import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_authenticated/dividend")({
  component: () => (
    <ModuleStub
      title="Stock Dividend Payables"
      description="Manage stock dividends with shares × rate calculation, grouped by fiscal year."
      phase="Phase 4"
    />
  ),
});
