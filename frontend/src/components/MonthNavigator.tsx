import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addMonths, formatMonthLabel, isCurrentMonth } from '@/lib/utils';

interface MonthNavigatorProps {
  month: string;
  onChange: (month: string) => void;
}

export function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  const atCurrent = isCurrentMonth(month);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-medium">
        {formatMonthLabel(month)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={atCurrent}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
