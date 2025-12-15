import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <div className={cn("empty-state", className)}>
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;