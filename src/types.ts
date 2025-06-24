import { DivideIcon as LucideIcon } from 'lucide-react';

export interface Child {
  id: string;
  name: string;
  age: number;
  color: string;
  sports: { name: string; color: string }[];
  eventCount: number;
  photo_url?: string;
  notes?: string;
  ownerName?: string; // For friends' children
  ownerPhoto?: string; // For friends' children
  accessRole?: 'viewer' | 'administrator'; // For friends' children
  isOwnProfile?: boolean; // To distinguish between own and friends' profiles
  user_id?: string; // The user ID who owns this profile
}

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

export interface Event {
  id: number;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
  sport: string;
  color: string;
  child: Child;
  platform: string;
  platformColor: string;
  platformIcon: LucideIcon;
  isToday: boolean;
  isOwnEvent?: boolean; // To distinguish between own and friends' events
  ownerName?: string; // For friends' events
}

export interface UserSettings {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  profile_photo_url: string | null;
  email_notifications: boolean;
  sms_notifications: boolean;
  in_app_notifications: boolean;
  schedule_updates: boolean;
  team_communications: boolean;
  all_notifications: boolean;
  language: string;
  theme: string;
  additional_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  role: 'none' | 'viewer' | 'administrator';
  created_at: string;
  updated_at: string;
  unreadCount?: number;
  lastMessageAt?: string;
  friend: {
    id: string;
    email: string;
    full_name?: string;
    profile_photo_url?: string;
  };
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  requested_id: string;
  status: 'pending' | 'accepted' | 'declined';
  role: 'none' | 'viewer' | 'administrator';
  message?: string;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    email: string;
    full_name?: string;
    profile_photo_url?: string;
  };
  requested?: {
    id: string;
    email: string;
    full_name?: string;
    profile_photo_url?: string;
  };
}