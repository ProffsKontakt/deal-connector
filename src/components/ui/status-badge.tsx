import { cn } from '@/lib/utils';

type Status = 'pending' | 'approved' | 'denied';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: {
    label: 'Väntande',
    className: 'status-pending border',
  },
  approved: {
    label: 'Godkänd',
    className: 'status-approved border',
  },
  denied: {
    label: 'Nekad',
    className: 'status-denied border',
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;