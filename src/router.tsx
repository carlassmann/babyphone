import { createRootRoute, createRoute, createRouter, Link, redirect } from '@tanstack/react-router';
import { MonitorPage, ActivityPage, SettingsPage } from './Room';
import { App, AppScreen, LandingScreen } from './App';
import { readSession } from './sessions';

const root = createRootRoute({
  component: App,
  notFoundComponent: () => (
    <main className="app-onboarding">
      <section>
        <h1>Page not found</h1>
        <Link to="/app" className="secondary">
          Open your monitor
        </Link>
      </section>
    </main>
  ),
});
const landing = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: LandingScreen,
  beforeLoad: ({ location }) => {
    if (new URLSearchParams(location.hash).has('join'))
      throw redirect({ to: '/app/join', hash: location.hash, replace: true });
    if (readSession()) throw redirect({ to: '/app', replace: true });
  },
});
const app = createRoute({
  getParentRoute: () => root,
  path: 'app',
  component: AppScreen,
  beforeLoad: ({ location }) => {
    if (!readSession() && ['/app/activity', '/app/settings'].includes(location.pathname))
      throw redirect({ to: '/app', replace: true });
  },
});
const appIndex = createRoute({ getParentRoute: () => app, path: '/', component: MonitorPage });
const activity = createRoute({
  getParentRoute: () => app,
  path: 'activity',
  component: ActivityPage,
});
const settings = createRoute({
  getParentRoute: () => app,
  path: 'settings',
  component: SettingsPage,
});
const create = createRoute({ getParentRoute: () => app, path: 'create', component: MonitorPage });
const join = createRoute({ getParentRoute: () => app, path: 'join', component: MonitorPage });

export const router = createRouter({
  routeTree: root.addChildren([
    landing,
    app.addChildren([appIndex, activity, settings, create, join]),
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
