import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  valueColor = "text-foreground",
  trend,
  className,
}: StatCardProps) => {
  return (
    <div className={cn("stat-card group", className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="stat-label">{title}</span>
        <div className={cn("p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="space-y-1">
        <div className={cn("stat-value", valueColor)}>{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
            trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;