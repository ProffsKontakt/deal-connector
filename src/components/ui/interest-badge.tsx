import { cn } from '@/lib/utils';
import { Sun, Battery, Zap } from 'lucide-react';

type Interest = 'sun' | 'battery' | 'sun_battery';

interface InterestBadgeProps {
  interest: Interest;
  className?: string;
}

const interestConfig: Record<Interest, { label: string; icon: React.ElementType; className: string }> = {
  sun: {
    label: 'Sol',
    icon: Sun,
    className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  battery: {
    label: 'Batteri',
    icon: Battery,
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  sun_battery: {
    label: 'Sol + Batteri',
    icon: Zap,
    className: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  },
};

export const InterestBadge = ({ interest, className }: InterestBadgeProps) => {
  const config = interestConfig[interest];
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

export default InterestBadge;