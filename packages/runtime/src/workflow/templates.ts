/**
 * Built-in workflow templates — 10 ready-to-use automations.
 *
 * Users can install these templates with one click. Each template declares
 * which MCP servers it needs, so the UI can prompt the user to install
 * any missing servers from Hive Market.
 */

import type { WorkflowTrigger, WorkflowStep } from "@hive-desktop/shared";

export interface WorkflowTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  requiredServers: string[];   // MCP server slugs needed
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export const workflowTemplates: WorkflowTemplate[] = [
  // ── 1. Payment Monitor ───────────────────────────────────
  {
    slug: "payment-monitor",
    name: "Payment Monitor",
    description: "Watch Stripe for payments above a threshold and send a Slack notification.",
    category: "payments",
    requiredServers: ["stripe-mcp", "slack-mcp"],
    trigger: { type: "interval", seconds: 300 },
    steps: [
      {
        id: "fetch-payments",
        name: "Fetch recent payments",
        type: "mcp_call",
        server: "stripe-mcp",
        tool: "list-charges",
        arguments: { limit: 10 },
        outputVar: "payments",
        onError: "stop",
      },
      {
        id: "filter-large",
        name: "Filter payments over threshold",
        type: "transform",
        condition: "payments.filter ? payments.filter(p => p.amount > 50000) : []",
        outputVar: "largePayments",
        onError: "stop",
      },
      {
        id: "check-any",
        name: "Check if any large payments",
        type: "condition",
        condition: "Array.isArray(largePayments) && largePayments.length > 0",
        onError: "stop",
      },
      {
        id: "notify-slack",
        name: "Send Slack notification",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#payments",
          text: "{{largePayments.length}} payment(s) over $500 detected!",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 5000,
      },
    ],
  },

  // ── 2. Issue Triager ─────────────────────────────────────
  {
    slug: "issue-triager",
    name: "Issue Triager",
    description: "Auto-label and categorize new GitHub issues using AI analysis.",
    category: "devtools",
    requiredServers: ["github-mcp"],
    trigger: { type: "interval", seconds: 600 },
    steps: [
      {
        id: "fetch-issues",
        name: "Fetch open issues",
        type: "mcp_call",
        server: "github-mcp",
        tool: "list_issues",
        arguments: { owner: "{{owner}}", repo: "{{repo}}", state: "open", per_page: 10 },
        outputVar: "issues",
        onError: "stop",
      },
      {
        id: "check-issues",
        name: "Check if there are issues to triage",
        type: "condition",
        condition: "Array.isArray(issues) && issues.length > 0",
        onError: "stop",
      },
      {
        id: "categorize",
        name: "Categorize first issue",
        type: "transform",
        condition: "({ title: issues[0].title, body: issues[0].body, number: issues[0].number })",
        outputVar: "currentIssue",
        onError: "continue",
      },
      {
        id: "log-result",
        name: "Log triage result",
        type: "notify",
        arguments: {
          title: "Issue Triaged",
          message: "Triaged issue #{{currentIssue.number}}: {{currentIssue.title}}",
        },
        onError: "continue",
      },
    ],
  },

  // ── 3. Error Alerter ─────────────────────────────────────
  {
    slug: "error-alerter",
    name: "Error Alerter",
    description: "Monitor for errors and create GitHub issues + send Slack alerts.",
    category: "devtools",
    requiredServers: ["github-mcp", "slack-mcp"],
    trigger: { type: "interval", seconds: 300 },
    steps: [
      {
        id: "check-errors",
        name: "Check for recent errors",
        type: "mcp_call",
        server: "github-mcp",
        tool: "search_issues",
        arguments: { q: "is:issue is:open label:bug created:>{{yesterday}}" },
        outputVar: "errors",
        onError: "stop",
      },
      {
        id: "has-errors",
        name: "Check if new errors found",
        type: "condition",
        condition: "errors && errors.total_count > 0",
        onError: "stop",
      },
      {
        id: "alert-slack",
        name: "Alert in Slack",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#alerts",
          text: "New errors detected: {{errors.total_count}} issue(s) found",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 3000,
      },
    ],
  },

  // ── 4. Daily Digest ──────────────────────────────────────
  {
    slug: "daily-digest",
    name: "Daily Digest",
    description: "Summarize daily GitHub activity and send a morning digest.",
    category: "productivity",
    requiredServers: ["github-mcp", "slack-mcp"],
    trigger: { type: "schedule", cron: "0 9 * * 1-5" },
    steps: [
      {
        id: "fetch-activity",
        name: "Fetch recent commits",
        type: "mcp_call",
        server: "github-mcp",
        tool: "list_commits",
        arguments: { owner: "{{owner}}", repo: "{{repo}}", perPage: 20 },
        outputVar: "commits",
        onError: "stop",
      },
      {
        id: "summarize",
        name: "Build summary",
        type: "transform",
        condition: "({ commitCount: Array.isArray(commits) ? commits.length : 0, date: new Date().toLocaleDateString() })",
        outputVar: "summary",
        onError: "stop",
      },
      {
        id: "send-digest",
        name: "Send daily digest to Slack",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#daily-digest",
          text: "Daily Digest ({{summary.date}}): {{summary.commitCount}} commits today",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 5000,
      },
    ],
  },

  // ── 5. Deploy Watcher ────────────────────────────────────
  {
    slug: "deploy-watcher",
    name: "Deploy Watcher",
    description: "Watch deployments and alert on failures.",
    category: "devtools",
    requiredServers: ["github-mcp", "slack-mcp"],
    trigger: { type: "interval", seconds: 120 },
    steps: [
      {
        id: "check-deployments",
        name: "Check recent workflow runs",
        type: "mcp_call",
        server: "github-mcp",
        tool: "search_issues",
        arguments: { q: "is:pr is:merged label:deploy" },
        outputVar: "deployments",
        onError: "stop",
      },
      {
        id: "has-deploys",
        name: "Check for recent deployments",
        type: "condition",
        condition: "deployments && deployments.total_count > 0",
        onError: "stop",
      },
      {
        id: "notify-deploy",
        name: "Notify about deployment",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#deploys",
          text: "Deployment activity detected: {{deployments.total_count}} recent deploy(s)",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 3000,
      },
    ],
  },

  // ── 6. Customer Onboarding ───────────────────────────────
  {
    slug: "customer-onboarding",
    name: "Customer Onboarding",
    description: "Welcome new customers with a Slack notification when a new Stripe customer is created.",
    category: "payments",
    requiredServers: ["stripe-mcp", "slack-mcp"],
    trigger: { type: "interval", seconds: 600 },
    steps: [
      {
        id: "fetch-customers",
        name: "Fetch recent customers",
        type: "mcp_call",
        server: "stripe-mcp",
        tool: "list-customers",
        arguments: { limit: 5 },
        outputVar: "customers",
        onError: "stop",
      },
      {
        id: "has-new",
        name: "Check for new customers",
        type: "condition",
        condition: "Array.isArray(customers) && customers.length > 0",
        onError: "stop",
      },
      {
        id: "welcome-slack",
        name: "Post welcome in Slack",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#customers",
          text: "New customer onboarded! Total recent: {{customers.length}}",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 3000,
      },
    ],
  },

  // ── 7. Dependency Auditor ────────────────────────────────
  {
    slug: "dependency-auditor",
    name: "Dependency Auditor",
    description: "Weekly audit of dependencies — create issues for vulnerabilities.",
    category: "devtools",
    requiredServers: ["github-mcp"],
    trigger: { type: "schedule", cron: "0 10 * * 1" },
    steps: [
      {
        id: "search-vulns",
        name: "Search for security issues",
        type: "mcp_call",
        server: "github-mcp",
        tool: "search_issues",
        arguments: { q: "is:issue is:open label:security repo:{{owner}}/{{repo}}" },
        outputVar: "securityIssues",
        onError: "stop",
      },
      {
        id: "log-audit",
        name: "Log audit results",
        type: "notify",
        arguments: {
          title: "Dependency Audit",
          message: "Found {{securityIssues.total_count}} open security issue(s)",
        },
        onError: "continue",
      },
    ],
  },

  // ── 8. Content Pipeline ──────────────────────────────────
  {
    slug: "content-pipeline",
    name: "Content Pipeline",
    description: "Watch a folder for new markdown files and notify when content is ready.",
    category: "content",
    requiredServers: ["slack-mcp"],
    trigger: { type: "file_watch", path: "./content", event: "create" },
    steps: [
      {
        id: "notify-new-content",
        name: "Notify about new content",
        type: "notify",
        arguments: {
          title: "New Content Detected",
          message: "A new file was added to the content directory",
        },
        onError: "continue",
      },
      {
        id: "slack-content",
        name: "Notify content team on Slack",
        type: "mcp_call",
        server: "slack-mcp",
        tool: "send-message",
        arguments: {
          channel: "#content",
          text: "New content file detected! Ready for review.",
        },
        onError: "retry",
        retryCount: 2,
        retryDelay: 3000,
      },
    ],
  },

  // ── 9. Competitor Monitor ────────────────────────────────
  {
    slug: "competitor-monitor",
    name: "Competitor Monitor",
    description: "Daily search for competitor mentions and summarize findings.",
    category: "analytics",
    requiredServers: ["brave-search-mcp"],
    trigger: { type: "schedule", cron: "0 8 * * 1-5" },
    steps: [
      {
        id: "search-mentions",
        name: "Search for competitor mentions",
        type: "mcp_call",
        server: "brave-search-mcp",
        tool: "brave_web_search",
        arguments: { query: "{{competitor_name}} announcement OR launch OR update" },
        outputVar: "searchResults",
        onError: "stop",
      },
      {
        id: "log-findings",
        name: "Log competitor findings",
        type: "notify",
        arguments: {
          title: "Competitor Monitor",
          message: "Competitor search completed. Check results for insights.",
        },
        onError: "continue",
      },
    ],
  },

  // ── 10. Database Backup Alert ────────────────────────────
  {
    slug: "database-backup-alert",
    name: "Database Backup Alert",
    description: "Periodically check database status and alert if backups are stale.",
    category: "data",
    requiredServers: ["supabase-mcp"],
    trigger: { type: "interval", seconds: 3600 },
    steps: [
      {
        id: "check-status",
        name: "Check database health",
        type: "mcp_call",
        server: "supabase-mcp",
        tool: "list_projects",
        arguments: {},
        outputVar: "projects",
        onError: "stop",
      },
      {
        id: "has-projects",
        name: "Verify projects exist",
        type: "condition",
        condition: "Array.isArray(projects) && projects.length > 0",
        onError: "stop",
      },
      {
        id: "log-status",
        name: "Log backup check result",
        type: "notify",
        arguments: {
          title: "Database Status",
          message: "Database check completed. {{projects.length}} project(s) found.",
        },
        onError: "continue",
      },
    ],
  },
];

/**
 * Get all available templates.
 */
export function getTemplates(): WorkflowTemplate[] {
  return workflowTemplates;
}

/**
 * Get a template by slug.
 */
export function getTemplate(slug: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((t) => t.slug === slug);
}
