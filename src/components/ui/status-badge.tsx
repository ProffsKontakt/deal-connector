import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

type Status = 'pending' | 'approved' | 'denied';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string; icon: typeof Clock }> = {
  pending: {
    label: 'Väntande',
    className: 'bg-warning/10 text-warning border-warning/20',
    icon: Clock,
  },
  approved: {
    label: 'Godkänd',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: CheckCircle,
  },
  denied: {
    label: 'Nekad',
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: XCircle,
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

export default StatusBadge;