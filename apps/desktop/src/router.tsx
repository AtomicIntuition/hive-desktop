import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { DashboardPage } from "@/pages/dashboard";
import { WorkflowsPage } from "@/pages/workflows";
import { ServersPage } from "@/pages/servers";
import { VaultPage } from "@/pages/vault";
import { SettingsPage } from "@/pages/settings";

function PageWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: (
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <PageWrapper><DashboardPage /></PageWrapper> },
      { path: "workflows", element: <PageWrapper><WorkflowsPage /></PageWrapper> },
      { path: "servers", element: <PageWrapper><ServersPage /></PageWrapper> },
      { path: "vault", element: <PageWrapper><VaultPage /></PageWrapper> },
      { path: "settings", element: <PageWrapper><SettingsPage /></PageWrapper> },
    ],
  },
]);
