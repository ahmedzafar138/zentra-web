import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/form-correction")({
  component: () => <Outlet />,
});
