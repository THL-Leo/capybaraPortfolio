import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Overview', end: true, icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/spending', label: 'Spending', icon: Receipt },
  { to: '/tracker', label: 'Tracker', icon: TrendingUp },
];

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <span className="shrink-0 text-base font-semibold tracking-tight text-foreground">
            Capybara
          </span>
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.username}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
