import { Link } from 'react-router-dom';
import type { PlaidAccount } from '@/api/types';
import {
  type AccountSection as AccountSectionData,
  bucketLabel,
  formatSectionSubtotal,
} from '@/lib/accountGroups';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatMoney } from '@/lib/utils';

const ACCOUNT_GRID_COLS =
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(6.5rem,auto)_minmax(7.5rem,auto)]';

interface AccountsGroupedTableProps {
  sections: AccountSectionData[];
}

export function AccountsGroupedTable({ sections }: AccountsGroupedTableProps) {
  if (!sections.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts by category</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Shared column headers — grid keeps widths aligned across all sections */}
        <div
          className={cn(
            ACCOUNT_GRID_COLS,
            'border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-capy-muted',
          )}
        >
          <div>Account</div>
          <div>Institution</div>
          <div>Type</div>
          <div className="text-right">Balance</div>
        </div>

        {sections.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionBlock({ section }: { section: AccountSectionData }) {
  const isCredit = section.key === 'credit';

  return (
    <div className="border-b last:border-b-0">
      <div
        className={cn(
          ACCOUNT_GRID_COLS,
          'items-center bg-muted/40 px-4 py-2.5 text-sm font-semibold',
        )}
      >
        <div className="col-span-3">{section.title}</div>
        <div className={cn('text-right', isCredit && 'text-destructive')}>
          {formatSectionSubtotal(section.key, section.subtotal)}
        </div>
      </div>

      {section.accounts.map((acc) => (
        <AccountGridRow key={acc.account_id} account={acc} isCredit={isCredit} />
      ))}
    </div>
  );
}

function AccountGridRow({ account, isCredit }: { account: PlaidAccount; isCredit: boolean }) {
  return (
    <div
      className={cn(
        ACCOUNT_GRID_COLS,
        'items-center border-t border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30',
      )}
    >
      <div className="min-w-0 truncate">
        <Link
          to={`/accounts/${account.account_id}`}
          className="text-capy-primary hover:underline"
        >
          {account.name}
          {account.mask && <span className="text-capy-muted"> ···{account.mask}</span>}
        </Link>
      </div>
      <div className="min-w-0 truncate text-capy-muted">{account.institution_name ?? '—'}</div>
      <div>
        <Badge>{bucketLabel(account.bucket)}</Badge>
      </div>
      <div className={cn('text-right tabular-nums', isCredit && 'text-destructive')}>
        {formatMoney(account.current_balance)}
      </div>
    </div>
  );
}