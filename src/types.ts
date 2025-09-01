import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { DivideIcon as LucideIcon } from 'lucide-react';

export interface Child {
  id: string;
  name: string;
  date_of_birth?: string | null;
  color: string;
  photo_url?: string | null;
  notes?: string;
  user_id?: string;
  sports: { name: string; color: string }[];
  eventCount: number;
  isOwnProfile?: boolean;
  ownerName?: string;
  ownerPhoto?: string;
  accessRole?: 'none' | 'viewer' | 'administrator';
}
// Base types
export interface Platform {
  id: number;
  name: string;
  icon: LucideIcon;
  color: string;
  connected: boolean;
  hasIssue: boolean;
  teamCount?: number;
  lastSynced?: string | null;
}
export interface UserSettings {
export interface Event {
  id: string | number;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  location_name?: string;
  sport: string;
  color: string;
  child: Child;
  platform: string;
  platformColor: string;
  platformIcon: LucideIcon;
  sportIcon?: IconDefinition;
  isToday?: boolean;
  isOwnEvent?: boolean;
  ownerName?: string;
  visibility?: 'public' | 'private';
}
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  in_app_notifications: boolean;
  schedule_updates: boolean;
  team_communications: boolean;
  all_notifications: boolean;
  language: string;
  theme: string;
  timezone: string;
  additional_emails: string[];
  notification_lead_time_minutes?: number;
}