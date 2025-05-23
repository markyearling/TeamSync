import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Calendar, Users, Link, BarChart } from 'lucide-react';
import { Child, Platform, Event } from '../types';

interface AppContextType {
  user: {
    name: string;
    email: string;
  };
  children: Child[];
  platforms: Platform[];
  connectedPlatforms: Platform[];
  events: Event[];
  upcomingEvents: Event[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Mock data for demonstration
  const [user] = useState({
    name: 'John Smith',
    email: 'john.smith@example.com',
  });

  const [childrenData] = useState<Child[]>([
    {
      id: '1',
      name: 'Emma',
      age: 10,
      color: '#3B82F6', // Blue
      sports: [
        { name: 'Soccer', color: '#10B981' }, // Green
        { name: 'Swimming', color: '#3B82F6' }, // Blue
      ],
      eventCount: 5,
    },
    {
      id: '2',
      name: 'Jack',
      age: 8,
      color: '#EF4444', // Red
      sports: [
        { name: 'Baseball', color: '#F59E0B' }, // Yellow
        { name: 'Basketball', color: '#EF4444' }, // Red
      ],
      eventCount: 3,
    },
    {
      id: '3',
      name: 'Sophia',
      age: 12,
      color: '#8B5CF6', // Purple
      sports: [
        { name: 'Volleyball', color: '#EC4899' }, // Pink
        { name: 'Tennis', color: '#8B5CF6' }, // Purple
      ],
      eventCount: 4,
    },
  ]);

  const [platformsData] = useState<Platform[]>([
    {
      id: 1,
      name: 'SportsEngine',
      icon: Calendar,
      color: '#2563EB', // Blue
      connected: true,
      hasIssue: false,
    },
    {
      id: 2,
      name: 'TeamSnap',
      icon: Users,
      color: '#7C3AED', // Purple
      connected: true,
      hasIssue: false,
    },
    {
      id: 3,
      name: 'PlayMetrics',
      icon: BarChart,
      color: '#10B981', // Green
      connected: false,
      hasIssue: false,
    },
    {
      id: 4,
      name: 'GameChanger',
      icon: Link,
      color: '#F97316', // Orange
      connected: true,
      hasIssue: true,
    },
  ]);

  // Generate mock events
  const generateEvents = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const events: Event[] = [];
    
    // Create events for each child
    childrenData.forEach(child => {
      child.sports.forEach(sport => {
        // Generate some events for the current month
        for (let i = 1; i <= 28; i++) {
          // Only create events on certain days to avoid too many
          if (i % 3 === 0 || i % 5 === 0) {
            const isGame = i % 3 === 0;
            const startTime = new Date(year, month, i, 16 + (i % 4), 0);
            const endTime = new Date(startTime);
            endTime.setHours(endTime.getHours() + (isGame ? 2 : 1.5));
            
            const platform = platformsData[Math.floor(Math.random() * platformsData.length)];
            
            events.push({
              id: events.length + 1,
              title: `${sport.name} ${isGame ? 'Game' : 'Practice'}`,
              description: isGame 
                ? `${child.name}'s ${sport.name} game against ${['Tigers', 'Eagles', 'Warriors', 'Sharks'][i % 4]}`
                : `Regular ${sport.name} practice session`,
              startTime,
              endTime,
              location: isGame 
                ? `${['City Park', 'Memorial Field', 'Community Center', 'Sports Complex'][i % 4]}`
                : `Training Center`,
              sport: sport.name,
              color: sport.color,
              child,
              platform: platform.name,
              platformColor: platform.color,
              platformIcon: platform.icon,
              isToday: startTime.getDate() === now.getDate(),
            });
          }
        }
      });
    });
    
    return events;
  };

  const [events] = useState<Event[]>(generateEvents());
  
  // Upcoming events (today and future)
  const upcomingEvents = events
    .filter(event => event.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const value = {
    user,
    children: childrenData,
    platforms: platformsData,
    connectedPlatforms: platformsData.filter(p => p.connected),
    events,
    upcomingEvents,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};