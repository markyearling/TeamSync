import {
  type Icon, // Correct type import for Lucide icons
  Waves,
  Snowflake,
  Crosshair,
  Timer,
  Flag,
  Star,
  HelpCircle,
  Dumbbell,
  Zap, // Generic icon for basketball
  TennisBall, // Specific tennis icon
  Volleyball, // Specific volleyball icon
} from 'lucide-react';

// Import sports icons from react-icons
import { 
  MdSportsSoccer,
  MdSportsBaseball,
  MdSportsBasketball,
  MdSportsFootball,
  MdSportsGolf,
  MdSportsTennis,
  MdSportsVolleyball,
  MdSportsHockey
} from 'react-icons/md';

export interface SportDetails {
  name: string;
  color: string;
  icon: Icon | React.ComponentType<any>; // Allow both Lucide and React Icons
}

export const availableSports: SportDetails[] = [
  { name: 'Soccer', color: '#10B981', icon: MdSportsSoccer },
  { name: 'Baseball', color: '#F59E0B', icon: MdSportsBaseball },
  { name: 'Basketball', color: '#EF4444', icon: MdSportsBasketball },
  { name: 'Swimming', color: '#3B82F6', icon: Waves },
  { name: 'Tennis', color: '#8B5CF6', icon: MdSportsTennis },
  { name: 'Volleyball', color: '#EC4899', icon: MdSportsVolleyball },
  { name: 'Football', color: '#6366F1', icon: MdSportsFootball },
  { name: 'Hockey', color: '#14B8A6', icon: MdSportsHockey },
  { name: 'Lacrosse', color: '#F97316', icon: Crosshair },
  { name: 'Track', color: '#06B6D4', icon: Timer },
  { name: 'Golf', color: '#84CC16', icon: MdSportsGolf },
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

export const getSportIcon = (sportName: string): Icon | React.ComponentType<any> => {
  return getSportDetails(sportName).icon;
};

export const getSportColor = (sportName: string): string => {
  return getSportDetails(sportName).color;
};