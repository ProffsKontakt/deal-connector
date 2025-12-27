import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Settings2, Target, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdSettings {
  greenThreshold: number;
  yellowThreshold: number;
  redThreshold: number;
  targetLeadsPerCompany: number;
}

interface PartnerGoalsSettingsProps {
  onSettingsChange?: (settings: ThresholdSettings) => void;
}

const DEFAULT_SETTINGS: ThresholdSettings = {
  greenThreshold: 4,
  yellowThreshold: 2,
  redThreshold: 1,
  targetLeadsPerCompany: 3,
};

export function PartnerGoalsSettings({ onSettingsChange }: PartnerGoalsSettingsProps) {
  const [settings, setSettings] = useState<ThresholdSettings>(() => {
    const saved = localStorage.getItem('partnerGoalsSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const handleSave = () => {
    localStorage.setItem('partnerGoalsSettings', JSON.stringify(settings));
    setIsEditing(false);
    toast.success('Inställningar sparade');
    onSettingsChange?.(settings);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h4 className="font-medium">Mål & Tröskelvärden</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Settings2 className="w-4 h-4 mr-1" />
          {isEditing ? 'Avbryt' : 'Redigera'}
        </Button>
      </div>

      {isEditing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="greenThreshold" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              Grön tröskel (antal partners)
            </Label>
            <Input
              id="greenThreshold"
              type="number"
              value={settings.greenThreshold}
              onChange={(e) => setSettings(s => ({ ...s, greenThreshold: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">≥ detta antal = Grön</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="yellowThreshold" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              Orange tröskel (antal partners)
            </Label>
            <Input
              id="yellowThreshold"
              type="number"
              value={settings.yellowThreshold}
              onChange={(e) => setSettings(s => ({ ...s, yellowThreshold: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">≥ detta antal = Orange</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="redThreshold" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Röd tröskel (antal partners)
            </Label>
            <Input
              id="redThreshold"
              type="number"
              value={settings.redThreshold}
              onChange={(e) => setSettings(s => ({ ...s, redThreshold: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">&lt; detta antal = Röd</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetLeadsPerCompany" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Målantal partners per lead
            </Label>
            <Input
              id="targetLeadsPerCompany"
              type="number"
              value={settings.targetLeadsPerCompany}
              onChange={(e) => setSettings(s => ({ ...s, targetLeadsPerCompany: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={handleSave} className="w-full">
              Spara inställningar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{settings.greenThreshold}+</p>
              <p className="text-xs text-muted-foreground">partners = Grön</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{settings.yellowThreshold}+</p>
              <p className="text-xs text-muted-foreground">partners = Orange</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">&lt;{settings.redThreshold + 1}</p>
              <p className="text-xs text-muted-foreground">partners = Röd</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{settings.targetLeadsPerCompany}</p>
              <p className="text-xs text-muted-foreground">målantal partners/lead</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function getThresholdColor(partnerCount: number, settings: ThresholdSettings): string {
  if (partnerCount >= settings.greenThreshold) return 'text-emerald-600 bg-emerald-500/10';
  if (partnerCount >= settings.yellowThreshold) return 'text-amber-600 bg-amber-500/10';
  return 'text-red-600 bg-red-500/10';
}

export { DEFAULT_SETTINGS };
export type { ThresholdSettings };
