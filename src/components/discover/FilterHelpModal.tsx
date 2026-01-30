import { HelpCircle, Flame, Leaf, Fish, Drumstick, Sun, Heart, Droplets, Activity, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useState } from 'react';

interface CriteriaItem {
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  criteria: string;
}

const DIET_CRITERIA: CriteriaItem[] = [
  {
    label: 'Keto',
    icon: <Flame className="w-4 h-4" />,
    bgClass: 'bg-emerald-500',
    criteria: '≤ 8g net carbs per serving, ≥ 70% calories from fat, ≤ 25% calories from protein',
  },
  {
    label: 'Paleo',
    icon: <Drumstick className="w-4 h-4" />,
    bgClass: 'bg-amber-600',
    criteria: 'No grains, legumes, dairy, or refined vegetable oils',
  },
  {
    label: 'Mediterranean',
    icon: <Sun className="w-4 h-4" />,
    bgClass: 'bg-orange-500',
    criteria: 'No red meat, processed foods, refined grains, or high saturated fats',
  },
  {
    label: 'Vegan',
    icon: <Leaf className="w-4 h-4" />,
    bgClass: 'bg-green-600',
    criteria: 'No animal products (meat, dairy, eggs, honey)',
  },
  {
    label: 'Vegetarian',
    icon: <Leaf className="w-4 h-4" />,
    bgClass: 'bg-lime-500',
    criteria: 'No meat or fish, but allows dairy and eggs',
  },
  {
    label: 'Pescatarian',
    icon: <Fish className="w-4 h-4" />,
    bgClass: 'bg-sky-500',
    criteria: 'Fish and seafood allowed, no other meat',
  },
];

const HEALTH_CRITERIA: CriteriaItem[] = [
  {
    label: 'Low Sodium',
    icon: <Droplets className="w-4 h-4" />,
    bgClass: 'bg-cyan-500',
    criteria: '< 300mg sodium per serving',
  },
  {
    label: 'Kidney Friendly',
    icon: <Droplets className="w-4 h-4" />,
    bgClass: 'bg-purple-500',
    criteria: '< 400mg sodium + < 30g protein per serving',
  },
  {
    label: 'Diabetes Friendly',
    icon: <Activity className="w-4 h-4" />,
    bgClass: 'bg-blue-500',
    criteria: '≥ 5g fiber + < 40g carbs per serving',
  },
  {
    label: 'Heart Healthy',
    icon: <Heart className="w-4 h-4" />,
    bgClass: 'bg-rose-500',
    criteria: '≥ 5g fiber + < 300mg sodium per serving',
  },
];

export function FilterHelpModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex-shrink-0 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          aria-label="Filter criteria help"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Filter Criteria Guide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Diet Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              Diet Types
            </h3>
            <div className="space-y-3">
              {DIET_CRITERIA.map((item) => (
                <div key={item.label} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg ${item.bgClass} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.criteria}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              Health Considerations
            </h3>
            <div className="space-y-3">
              {HEALTH_CRITERIA.map((item) => (
                <div key={item.label} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg ${item.bgClass} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.criteria}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Recipes are auto-detected based on their nutrition data and ingredients. 
              Hover over badges on recipe cards to see specific criteria.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
