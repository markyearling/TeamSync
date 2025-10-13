import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { 
  faFutbol,
  faBaseballBall,
  faBasketballBall,
  faSwimmer,
  faTableTennisPaddleBall,
  faVolleyballBall,
  faFootballBall,
  faHockeyPuck,
  faBullseye,
  faRunning,
  faGolfBall,
  faStar,
  faDumbbell,
  faQuestion,
  faShuffle
} from '@fortawesome/free-solid-svg-icons';

export interface SportDetails {
  name: string;
  color: string;
  icon: IconDefinition;
}

export const availableSports: SportDetails[] = [
  { name: 'Soccer', color: '#10B981', icon: faFutbol },
  { name: 'Baseball', color: '#F59E0B', icon: faBaseballBall },
  { name: 'Basketball', color: '#EF4444', icon: faBasketballBall },
  { name: 'Swimming', color: '#3B82F6', icon: faSwimmer },
  { name: 'Tennis', color: '#8B5CF6', icon: faTableTennisPaddleBall },
  { name: 'Volleyball', color: '#EC4899', icon: faVolleyballBall },
  { name: 'Football', color: '#6366F1', icon: faFootballBall },
  { name: 'Hockey', color: '#14B8A6', icon: faHockeyPuck },
  { name: 'Lacrosse', color: '#F97316', icon: faBullseye },
  { name: 'Track', color: '#06B6D4', icon: faRunning },
  { name: 'Golf', color: '#84CC16', icon: faGolfBall },
  { name: 'Gymnastics', color: '#F43F5E', icon: faStar },
  { name: 'Wrestling', color: '#8B5CF6', icon: faDumbbell },
  { name: 'Cross Country', color: '#059669', icon: faRunning },
  { name: 'Unknown', color: '#64748B', icon: faQuestion },
  { name: 'Other', color: '#64748B', icon: faShuffle }
];

export const getSportDetails = (sportName: string): SportDetails => {
  const sport = availableSports.find(s => s.name.toLowerCase() === sportName.toLowerCase());
  return sport || { name: sportName, color: '#64748B', icon: faQuestion };
};

export const getSportIcon = (sportName: string): IconDefinition => {
  return getSportDetails(sportName).icon;
};

export const getSportColor = (sportName: string): string => {
  return getSportDetails(sportName).color;
};