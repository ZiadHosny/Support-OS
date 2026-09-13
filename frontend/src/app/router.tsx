import { createBrowserRouter } from 'react-router'

import { PublicLayout } from './PublicLayout'
import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import {
  RedirectAuthenticated,
  RedirectPortalOnly,
  RequireAuth,
  RequirePermission,
} from '@/shared/auth'

export const router = createBrowserRouter([
  {
    // The public front door. A second `PublicLayout` instance rather than a
    // child of the tree below, because the landing page needs the `full`
    // variant (edge-to-edge section bands) while every page below it is a
    // centred card. Same shell component, no third layout type — see
    // `SupportOs backlog.MD` LAND-1's own constraint.
    element: <PublicLayout variant="full" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RedirectAuthenticated />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { LandingPage } = await import('@/features/landing/components/LandingPage')
              return { element: <LandingPage /> }
            },
          },
        ],
      },
    ],
  },
  {
    // Pathless — matched purely by its children's own paths, not nested
    // under `path: '/'`. Kept separate from the staff `RootLayout` tree
    // below so `/login`, `/chat`, `/contact` never render the staff
    // `Sidebar` (nav links, language/theme controls meant for a signed-in
    // session), the same reasoning `portal` already gets its own sibling
    // tree instead of nesting inside `RootLayout`.
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'login',
        lazy: async () => {
          const { LoginPage } = await import('@/features/auth/components/LoginPage')
          return { element: <LoginPage /> }
        },
      },
      {
        path: 'chat',
        lazy: async () => {
          const { LiveChatWidget } = await import('@/features/live-chat/components/LiveChatWidget')
          return { element: <LiveChatWidget /> }
        },
      },
      {
        path: 'contact',
        lazy: async () => {
          const { WebFormPage } = await import('@/features/web-form/components/WebFormPage')
          return { element: <WebFormPage /> }
        },
      },
      {
        path: 'set-password',
        lazy: async () => {
          const { SetPasswordPage } = await import('@/features/auth/components/SetPasswordPage')
          return { element: <SetPasswordPage /> }
        },
      },
      {
        path: 'forgot-password',
        lazy: async () => {
          const { ForgotPasswordPage } =
            await import('@/features/auth/components/ForgotPasswordPage')
          return { element: <ForgotPasswordPage /> }
        },
      },
      {
        path: 'reset-password',
        lazy: async () => {
          const { ResetPasswordPage } = await import('@/features/auth/components/ResetPasswordPage')
          return { element: <ResetPasswordPage /> }
        },
      },
    ],
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            // Wraps the WHOLE staff route tree below — every route a
            // signed-in account can reach under `/` — not just `/home`.
            // A narrower version of this wrapped only `/home`, leaving
            // `tasks`, `preferences`, and the `*` catch-all (all
            // deliberately ungated — see their own comments below)
            // reachable by a portal/customer account that typed or
            // bookmarked one of those URLs directly, since none of them
            // fail a `RequirePermission` check first to bounce through
            // `/home` on the way to `/portal`. See `RedirectPortalOnly`'s
            // own docstring for the incident this fixed.
            element: <RedirectPortalOnly />,
            children: [
              {
                path: 'home',
                lazy: async () => {
                  const { HomePage } = await import('@/app/HomePage')
                  return { element: <HomePage /> }
                },
              },
              {
                element: <RequirePermission permission="customers.view" />,
                children: [
                  {
                    path: 'customers',
                    lazy: async () => {
                      const { CustomerListPage } =
                        await import('@/features/customers/components/CustomerListPage')
                      return { element: <CustomerListPage /> }
                    },
                    // `new`/`:id/edit` nested under the list route — `DSN-15`
                    // (Story 112): `CustomerListPage` renders `<Outlet />`
                    // and these mount as its dialog.
                    children: [
                      {
                        path: 'new',
                        lazy: async () => {
                          const { CustomerFormDialog } =
                            await import('@/features/customers/components/CustomerFormPage')
                          return { element: <CustomerFormDialog /> }
                        },
                      },
                      {
                        path: ':id/edit',
                        lazy: async () => {
                          const { CustomerFormDialog } =
                            await import('@/features/customers/components/CustomerFormPage')
                          return { element: <CustomerFormDialog /> }
                        },
                      },
                    ],
                  },
                  {
                    path: 'customers/:id',
                    lazy: async () => {
                      const { CustomerProfilePage } =
                        await import('@/features/customers/components/CustomerProfilePage')
                      return { element: <CustomerProfilePage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="tickets.view" />,
                children: [
                  {
                    path: 'tickets',
                    lazy: async () => {
                      const { TicketListPage } =
                        await import('@/features/tickets/components/TicketListPage')
                      return { element: <TicketListPage /> }
                    },
                  },
                  {
                    // Must stay before `tickets/:id`, same reason as `customers/new`.
                    path: 'tickets/new',
                    lazy: async () => {
                      const { TicketFormPage } =
                        await import('@/features/tickets/components/TicketFormPage')
                      return { element: <TicketFormPage /> }
                    },
                  },
                  {
                    // Must stay before `tickets/:id`, same reason as `tickets/new`.
                    path: 'tickets/my-tickets',
                    lazy: async () => {
                      const { MyTicketsPage } =
                        await import('@/features/tickets/components/MyTicketsPage')
                      return { element: <MyTicketsPage /> }
                    },
                  },
                  {
                    path: 'tickets/:id',
                    lazy: async () => {
                      const { TicketDetailPage } =
                        await import('@/features/tickets/components/TicketDetailPage')
                      return { element: <TicketDetailPage /> }
                    },
                  },
                  {
                    path: 'tickets/:id/edit',
                    lazy: async () => {
                      const { TicketFormPage } =
                        await import('@/features/tickets/components/TicketFormPage')
                      return { element: <TicketFormPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="knowledge_base.manage" />,
                children: [
                  {
                    path: 'knowledge-base/manage',
                    lazy: async () => {
                      const { FaqListPage } =
                        await import('@/features/knowledge-base/components/FaqListPage')
                      return { element: <FaqListPage /> }
                    },
                    // `new`/`:id/edit` nested under the list route —
                    // `DSN-15` (Story 112): `FaqListPage` renders
                    // `<Outlet />` and these mount as its dialog.
                    children: [
                      {
                        path: 'new',
                        lazy: async () => {
                          const { FaqFormDialog } =
                            await import('@/features/knowledge-base/components/FaqFormPage')
                          return { element: <FaqFormDialog /> }
                        },
                      },
                      {
                        path: ':id/edit',
                        lazy: async () => {
                          const { FaqFormDialog } =
                            await import('@/features/knowledge-base/components/FaqFormPage')
                          return { element: <FaqFormDialog /> }
                        },
                      },
                    ],
                  },
                  {
                    // Must stay before `knowledge-base/articles/:id` (in the
                    // sibling knowledge_base.view block below) — a literal
                    // "manage" would otherwise be read as the `:id` param.
                    path: 'knowledge-base/articles/manage',
                    lazy: async () => {
                      const { ArticleListPage } =
                        await import('@/features/knowledge-base/components/ArticleListPage')
                      return { element: <ArticleListPage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/articles/manage/new',
                    lazy: async () => {
                      const { ArticleFormPage } =
                        await import('@/features/knowledge-base/components/ArticleFormPage')
                      return { element: <ArticleFormPage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/articles/manage/:id/edit',
                    lazy: async () => {
                      const { ArticleFormPage } =
                        await import('@/features/knowledge-base/components/ArticleFormPage')
                      return { element: <ArticleFormPage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/categories',
                    lazy: async () => {
                      const { CategoryListPage } =
                        await import('@/features/knowledge-base/components/CategoryListPage')
                      return { element: <CategoryListPage /> }
                    },
                    // `new`/`:id/edit` nested under the list route —
                    // `DSN-15` (Story 112): `CategoryListPage` renders
                    // `<Outlet />` and these mount as its dialog.
                    children: [
                      {
                        path: 'new',
                        lazy: async () => {
                          const { CategoryFormDialog } =
                            await import('@/features/knowledge-base/components/CategoryFormPage')
                          return { element: <CategoryFormDialog /> }
                        },
                      },
                      {
                        path: ':id/edit',
                        lazy: async () => {
                          const { CategoryFormDialog } =
                            await import('@/features/knowledge-base/components/CategoryFormPage')
                          return { element: <CategoryFormDialog /> }
                        },
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="knowledge_base.view" />,
                children: [
                  {
                    path: 'knowledge-base',
                    lazy: async () => {
                      const { FaqBrowsePage } =
                        await import('@/features/knowledge-base/components/FaqBrowsePage')
                      return { element: <FaqBrowsePage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/articles',
                    lazy: async () => {
                      const { ArticleBrowsePage } =
                        await import('@/features/knowledge-base/components/ArticleBrowsePage')
                      return { element: <ArticleBrowsePage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/articles/:id',
                    lazy: async () => {
                      const { ArticleReaderPage } =
                        await import('@/features/knowledge-base/components/ArticleReaderPage')
                      return { element: <ArticleReaderPage /> }
                    },
                  },
                  {
                    path: 'knowledge-base/search',
                    lazy: async () => {
                      const { SearchPage } =
                        await import('@/features/knowledge-base/components/SearchPage')
                      return { element: <SearchPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="users.view" />,
                children: [
                  {
                    path: 'users',
                    lazy: async () => {
                      const { UserListPage } =
                        await import('@/features/accounts/components/UserListPage')
                      return { element: <UserListPage /> }
                    },
                  },
                ],
              },
              {
                // Split from the `users.view`-gated list route above: create/edit
                // are writes (`POST`/`PATCH /api/users/`), gated server-side by
                // `users.manage`, not `users.view` — a `users.view`-only holder
                // (e.g. the seeded `manager` role) could previously navigate to
                // and fill out these forms only to have every submit 403 as a
                // guaranteed dead end. Matches `roles`'s own single-permission
                // gate below, just split across two permissions instead of one.
                element: <RequirePermission permission="users.manage" />,
                children: [
                  {
                    // Must stay before `users/:id`, same reason as `customers/new`.
                    path: 'users/new',
                    lazy: async () => {
                      const { UserFormPage } =
                        await import('@/features/accounts/components/UserFormPage')
                      return { element: <UserFormPage /> }
                    },
                  },
                  {
                    path: 'users/:id/edit',
                    lazy: async () => {
                      const { UserFormPage } =
                        await import('@/features/accounts/components/UserFormPage')
                      return { element: <UserFormPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="roles.manage" />,
                children: [
                  {
                    path: 'roles',
                    lazy: async () => {
                      const { RoleListPage } =
                        await import('@/features/accounts/components/RoleListPage')
                      return { element: <RoleListPage /> }
                    },
                  },
                  {
                    // Must stay before `roles/:id`, same reason as `users/new`.
                    path: 'roles/new',
                    lazy: async () => {
                      const { RoleFormPage } =
                        await import('@/features/accounts/components/RoleFormPage')
                      return { element: <RoleFormPage /> }
                    },
                  },
                  {
                    path: 'roles/:id/edit',
                    lazy: async () => {
                      const { RoleFormPage } =
                        await import('@/features/accounts/components/RoleFormPage')
                      return { element: <RoleFormPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="tickets.manage" />,
                children: [
                  {
                    path: 'categories',
                    lazy: async () => {
                      const { CategoryListPage } =
                        await import('@/features/tickets/components/CategoryListPage')
                      return { element: <CategoryListPage /> }
                    },
                    // `new`/`:id/edit` nested under the list route —
                    // `DSN-15` (Story 112): `CategoryListPage` renders
                    // `<Outlet />` and these mount as its dialog.
                    children: [
                      {
                        path: 'new',
                        lazy: async () => {
                          const { CategoryFormDialog } =
                            await import('@/features/tickets/components/CategoryFormPage')
                          return { element: <CategoryFormDialog /> }
                        },
                      },
                      {
                        path: ':id/edit',
                        lazy: async () => {
                          const { CategoryFormDialog } =
                            await import('@/features/tickets/components/CategoryFormPage')
                          return { element: <CategoryFormDialog /> }
                        },
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="reports.view" />,
                children: [
                  {
                    path: 'reports/tickets',
                    lazy: async () => {
                      const { TicketReportsPage } =
                        await import('@/features/reports/components/TicketReportsPage')
                      return { element: <TicketReportsPage /> }
                    },
                  },
                  {
                    path: 'reports/sla',
                    lazy: async () => {
                      const { SlaReportsPage } =
                        await import('@/features/reports/components/SlaReportsPage')
                      return { element: <SlaReportsPage /> }
                    },
                  },
                  {
                    path: 'reports/agents',
                    lazy: async () => {
                      const { AgentReportsPage } =
                        await import('@/features/reports/components/AgentReportsPage')
                      return { element: <AgentReportsPage /> }
                    },
                  },
                  {
                    path: 'reports/csat',
                    lazy: async () => {
                      const { CsatReportsPage } =
                        await import('@/features/reports/components/CsatReportsPage')
                      return { element: <CsatReportsPage /> }
                    },
                  },
                  {
                    path: 'reports/dashboard',
                    lazy: async () => {
                      const { ManagementDashboardPage } =
                        await import('@/features/reports/components/ManagementDashboardPage')
                      return { element: <ManagementDashboardPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="audit_log.view" />,
                children: [
                  {
                    path: 'audit-log',
                    lazy: async () => {
                      const { AuditLogListPage } =
                        await import('@/features/audit-log/components/AuditLogListPage')
                      return { element: <AuditLogListPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="settings.manage" />,
                children: [
                  {
                    path: 'settings',
                    lazy: async () => {
                      const { SettingsPage } =
                        await import('@/features/organization/components/SettingsPage')
                      return { element: <SettingsPage /> }
                    },
                  },
                  {
                    // LAND-2/LAND-3. No `view`/`manage` split like
                    // `departments` below: reads and writes are all
                    // `settings.manage` here, so one guard covers every
                    // landing-content and social-link route.
                    path: 'settings/landing',
                    lazy: async () => {
                      const { LandingContentPage } =
                        await import('@/features/organization/components/LandingContentPage')
                      return { element: <LandingContentPage /> }
                    },
                  },
                  {
                    path: 'settings/landing/highlights',
                    lazy: async () => {
                      const { LandingHighlightListPage } =
                        await import('@/features/organization/components/LandingHighlightListPage')
                      return { element: <LandingHighlightListPage /> }
                    },
                  },
                  {
                    // Must stay before `settings/landing/highlights/:id/edit`,
                    // same reason as `customers/new`. A full page, not a
                    // dialog (former `DSN-15` classification) — this form's
                    // three bilingual Cards with auto-growing textareas
                    // could exceed the viewport, clipping the Save button
                    // with no way to scroll to it.
                    path: 'settings/landing/highlights/new',
                    lazy: async () => {
                      const { LandingHighlightFormPage } =
                        await import('@/features/organization/components/LandingHighlightFormPage')
                      return { element: <LandingHighlightFormPage /> }
                    },
                  },
                  {
                    path: 'settings/landing/highlights/:id/edit',
                    lazy: async () => {
                      const { LandingHighlightFormPage } =
                        await import('@/features/organization/components/LandingHighlightFormPage')
                      return { element: <LandingHighlightFormPage /> }
                    },
                  },
                  {
                    // LAND-3.
                    path: 'settings/landing/social',
                    lazy: async () => {
                      const { LandingSocialLinkListPage } =
                        await import('@/features/organization/components/LandingSocialLinkListPage')
                      return { element: <LandingSocialLinkListPage /> }
                    },
                    // `new`/`:id/edit` nested under the list route —
                    // `DSN-15` (Story 112): `LandingSocialLinkListPage`
                    // renders `<Outlet />` and these mount as its dialog.
                    children: [
                      {
                        path: 'new',
                        lazy: async () => {
                          const { LandingSocialLinkFormDialog } =
                            await import('@/features/organization/components/LandingSocialLinkFormPage')
                          return { element: <LandingSocialLinkFormDialog /> }
                        },
                      },
                      {
                        path: ':id/edit',
                        lazy: async () => {
                          const { LandingSocialLinkFormDialog } =
                            await import('@/features/organization/components/LandingSocialLinkFormPage')
                          return { element: <LandingSocialLinkFormDialog /> }
                        },
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="integrations.manage" />,
                children: [
                  {
                    path: 'settings/erp',
                    lazy: async () => {
                      const { ErpSettingsPage } =
                        await import('@/features/integrations/components/ErpSettingsPage')
                      return { element: <ErpSettingsPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="communications.manage" />,
                children: [
                  {
                    path: 'settings/channels',
                    lazy: async () => {
                      const { ChannelSettingsPage } =
                        await import('@/features/communications/components/ChannelSettingsPage')
                      return { element: <ChannelSettingsPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="webhooks.manage" />,
                children: [
                  {
                    path: 'settings/webhooks',
                    lazy: async () => {
                      const { WebhookSubscriptionListPage } =
                        await import('@/features/webhooks/components/WebhookSubscriptionListPage')
                      return { element: <WebhookSubscriptionListPage /> }
                    },
                  },
                  {
                    // Must stay before `settings/webhooks/:id/edit`, same reason
                    // `roles/new` is declared before `roles/:id/edit` above.
                    path: 'settings/webhooks/new',
                    lazy: async () => {
                      const { WebhookSubscriptionFormPage } =
                        await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                      return { element: <WebhookSubscriptionFormPage /> }
                    },
                  },
                  {
                    path: 'settings/webhooks/:id/edit',
                    lazy: async () => {
                      const { WebhookSubscriptionFormPage } =
                        await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                      return { element: <WebhookSubscriptionFormPage /> }
                    },
                  },
                ],
              },
              {
                element: <RequirePermission permission="departments.view" />,
                children: [
                  {
                    path: 'settings/departments',
                    lazy: async () => {
                      const { DepartmentListPage } =
                        await import('@/features/organization/components/DepartmentListPage')
                      return { element: <DepartmentListPage /> }
                    },
                    children: [
                      {
                        // Split from the list route above for the same
                        // reason `users/new` is split from `users`:
                        // create/edit are writes the server gates on
                        // `departments.manage`, so a view-only holder must
                        // not be routed to a guaranteed dead end. Nested
                        // under the list route (not a sibling) since
                        // `DSN-15` (Story 112) — the list renders
                        // `<Outlet />` and these mount as its dialog.
                        element: <RequirePermission permission="departments.manage" />,
                        children: [
                          {
                            // Must stay before `:id/edit`, the same
                            // declaration order `roles/new` uses.
                            path: 'new',
                            lazy: async () => {
                              const { DepartmentFormDialog } =
                                await import('@/features/organization/components/DepartmentFormPage')
                              return { element: <DepartmentFormDialog /> }
                            },
                          },
                          {
                            path: ':id/edit',
                            lazy: async () => {
                              const { DepartmentFormDialog } =
                                await import('@/features/organization/components/DepartmentFormPage')
                              return { element: <DepartmentFormDialog /> }
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                element: <RequirePermission permission="branches.view" />,
                children: [
                  {
                    path: 'settings/branches',
                    lazy: async () => {
                      const { BranchListPage } =
                        await import('@/features/organization/components/BranchListPage')
                      return { element: <BranchListPage /> }
                    },
                    children: [
                      {
                        // Split from the list route above for the same
                        // reason the `departments.manage` group is split
                        // from its own list route (`DSN-15`, Story 112).
                        element: <RequirePermission permission="branches.manage" />,
                        children: [
                          {
                            // Must stay before `:id/edit`, the same
                            // declaration order `departments/new` uses.
                            path: 'new',
                            lazy: async () => {
                              const { BranchFormDialog } =
                                await import('@/features/organization/components/BranchFormPage')
                              return { element: <BranchFormDialog /> }
                            },
                          },
                          {
                            path: ':id/edit',
                            lazy: async () => {
                              const { BranchFormDialog } =
                                await import('@/features/organization/components/BranchFormPage')
                              return { element: <BranchFormDialog /> }
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                // SLA-5 (Story 111) — `BranchListPage`'s exact pair above,
                // for `BusinessCalendar`.
                element: <RequirePermission permission="calendars.view" />,
                children: [
                  {
                    path: 'settings/calendars',
                    lazy: async () => {
                      const { CalendarListPage } =
                        await import('@/features/organization/components/CalendarListPage')
                      return { element: <CalendarListPage /> }
                    },
                  },
                ],
              },
              {
                // Split from the `calendars.view` list route above, the
                // same reason the `branches.manage` group above is split
                // from its own list route.
                element: <RequirePermission permission="calendars.manage" />,
                children: [
                  {
                    // Must stay before `settings/calendars/:id/edit`, the
                    // same declaration order `branches/new` uses.
                    path: 'settings/calendars/new',
                    lazy: async () => {
                      const { CalendarFormPage } =
                        await import('@/features/organization/components/CalendarFormPage')
                      return { element: <CalendarFormPage /> }
                    },
                  },
                  {
                    path: 'settings/calendars/:id/edit',
                    lazy: async () => {
                      const { CalendarFormPage } =
                        await import('@/features/organization/components/CalendarFormPage')
                      return { element: <CalendarFormPage /> }
                    },
                  },
                ],
              },
              {
                path: 'tasks',
                lazy: async () => {
                  const { TaskListPage } = await import('@/features/tasks/components/TaskListPage')
                  return { element: <TaskListPage /> }
                },
                // `new`/`:id/edit` nested under the list route — `DSN-15`
                // (Story 112): `TaskListPage` renders `<Outlet />` and
                // these mount as its dialog. Ungated, same as `tasks`
                // itself — no `RequirePermission` layer to preserve.
                children: [
                  {
                    path: 'new',
                    lazy: async () => {
                      const { TaskFormDialog } =
                        await import('@/features/tasks/components/TaskFormPage')
                      return { element: <TaskFormDialog /> }
                    },
                  },
                  {
                    path: ':id/edit',
                    lazy: async () => {
                      const { TaskFormDialog } =
                        await import('@/features/tasks/components/TaskFormPage')
                      return { element: <TaskFormDialog /> }
                    },
                  },
                ],
              },
              {
                path: 'preferences',
                lazy: async () => {
                  const { PreferencesPage } = await import('./PreferencesPage')
                  return { element: <PreferencesPage /> }
                },
              },
              {
                // Inside `RequireAuth`, not a sibling of it: an unmatched path
                // must redirect a signed-out visitor to `/login` first, the same
                // as any real route above. A sibling catch-all would render
                // `NotFoundPage` (inside `RootLayout`'s staff Sidebar) for an
                // anonymous visitor instead of ever asking them to log in.
                path: '*',
                lazy: async () => {
                  const { NotFoundPage } = await import('./NotFoundPage')
                  return { element: <NotFoundPage /> }
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // Sibling of the `path: '/'` tree above, not nested inside it — a
    // customer-facing shell must not render inside the staff `RootLayout`
    // (staff nav, `NotificationBell`). See Story 42 `## Story Goal`.
    path: 'portal',
    lazy: async () => {
      const { PortalLayout } = await import('@/features/portal/components/PortalLayout')
      return { element: <PortalLayout /> }
    },
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequirePermission permission="portal.access" />,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { PortalHomePage } =
                    await import('@/features/portal/components/PortalHomePage')
                  return { element: <PortalHomePage /> }
                },
              },
              {
                path: 'faqs',
                lazy: async () => {
                  const { PortalFaqPage } =
                    await import('@/features/portal/components/PortalFaqPage')
                  return { element: <PortalFaqPage /> }
                },
              },
              {
                path: 'chat',
                lazy: async () => {
                  const { PortalChatbotPage } =
                    await import('@/features/portal/components/PortalChatbotPage')
                  return { element: <PortalChatbotPage /> }
                },
              },
              {
                path: 'articles',
                lazy: async () => {
                  const { PortalArticleListPage } =
                    await import('@/features/portal/components/PortalArticleListPage')
                  return { element: <PortalArticleListPage /> }
                },
              },
              {
                path: 'articles/:id',
                lazy: async () => {
                  const { PortalArticleReaderPage } =
                    await import('@/features/portal/components/PortalArticleReaderPage')
                  return { element: <PortalArticleReaderPage /> }
                },
              },
              {
                path: 'tickets',
                lazy: async () => {
                  const { PortalTicketListPage } =
                    await import('@/features/portal/components/PortalTicketListPage')
                  return { element: <PortalTicketListPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, same reason `tickets/new`
                // already does — a literal "history"/"new" segment would
                // otherwise match the `:id` param first.
                path: 'tickets/history',
                lazy: async () => {
                  const { PortalTicketHistoryPage } =
                    await import('@/features/portal/components/PortalTicketHistoryPage')
                  return { element: <PortalTicketHistoryPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, the same reason
                // `customers/new`/`tickets/new` are declared before their
                // own `:id` siblings elsewhere in this file.
                path: 'tickets/new',
                lazy: async () => {
                  const { PortalTicketFormPage } =
                    await import('@/features/portal/components/PortalTicketFormPage')
                  return { element: <PortalTicketFormPage /> }
                },
              },
              {
                path: 'tickets/:id',
                lazy: async () => {
                  const { PortalTicketDetailPage } =
                    await import('@/features/portal/components/PortalTicketDetailPage')
                  return { element: <PortalTicketDetailPage /> }
                },
              },
              {
                path: 'tickets/:id/feedback',
                lazy: async () => {
                  const { PortalFeedbackFormPage } =
                    await import('@/features/portal/components/PortalFeedbackFormPage')
                  return { element: <PortalFeedbackFormPage /> }
                },
              },
            ],
          },
        ],
      },
    ],
  },
])
