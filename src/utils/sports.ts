import { 
  Circle,
  Trophy,
  Target,
  Waves,
  Zap,
  Volleyball,
  Shield,
  Snowflake,
  Crosshair,
  Timer,
  Flag,
  Star,
  HelpCircle,
  Football,
  Dumbbell
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface SportDetails {
  name: string;
  color: string;
  icon: LucideIcon;
}

export const availableSports: SportDetails[] = [
  { name: 'Soccer', color: '#10B981', icon: Circle },
  { name: 'Baseball', color: '#F59E0B', icon: Circle },
  { name: 'Basketball', color: '#EF4444', icon: Circle },
  { name: 'Swimming', color: '#3B82F6', icon: Waves },
  { name: 'Tennis', color: '#8B5CF6', icon: Circle },
  { name: 'Volleyball', color: '#EC4899', icon: Volleyball },
  { name: 'Football', color: '#6366F1', icon: Football },
  { name: 'Hockey', color: '#14B8A6', icon: Snowflake },
  { name: 'Lacrosse', color: '#F97316', icon: Crosshair },
  { name: 'Track', color: '#06B6D4', icon: Timer },
  { name: 'Golf', color: '#84CC16', icon: Flag },
  { name: 'Gymnastics', color: '#F43F5E', icon: Star },
  { name: 'Wrestling', color: '#8B5CF6', icon: Dumbbell },
  { name: 'Cross Country', color: '#059669', icon: Timer },
  { name: 'Unknown', color: '#64748B', icon: HelpCircle },
  { name: 'Other', color: '#64748B', icon: HelpCircle }
];

export const getSportDetails = (sportName: string): SportDetails => {
  const sport = availableSports.find(s => s.name.toLowerCase() === sportName.toLowerCase());
  return sport || { name: sportName, color: '#64748B', icon: HelpCircle };
};

export const getSportIcon = (sportName: string): LucideIcon => {
  return getSportDetails(sportName).icon;
};

export const getSportColor = (sportName: string): string => {
  return getSportDetails(sportName).color;
};