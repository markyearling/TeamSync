# Friend Request Notification System Implementation

## Overview
Implemented a comprehensive notification system for friend requests that includes push notifications, email notifications, visual indicators, and real-time updates.

## Changes Made

### 1. Database Triggers and Functions

#### Migration: `add_friend_request_notification_system`
- Created `create_friend_request_notification()` trigger function
- Automatically creates database notification when friend request is inserted
- Extracts requester name and builds notification message
- Stores notification with friend request metadata

#### Migration: `add_notification_delivery_trigger`
- Created `deliver_notification()` trigger function
- Uses pg_net extension for async HTTP calls
- Sends FCM push notifications to all user devices
- Sends email notifications using SendGrid
- Only triggers for friend_request type notifications

#### Migration: `update_notification_delivery_use_env_vars`
- Updated to use Supabase vault for storing configuration
- Accesses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from vault
- Added proper error handling and logging

### 2. Edge Functions

#### New: `send-friend-request-email`
- Sends beautifully formatted email notifications
- Includes requester name and optional message
- Provides direct link to Friends page
- Explains what accepting a friend request means
- Falls back gracefully if SendGrid is not configured

### 3. Frontend Components

#### Updated: `Header.tsx`
- Added `friendRequestCount` state to track pending friend requests
- Created `fetchFriendRequestCount()` function to query friend_requests table
- Added real-time subscription to friend_requests changes
- Updated Friends icon badge:
  - Red badge shows friend request count (higher priority)
  - Blue badge shows unread message count (when no friend requests)
- Badge updates automatically when friend requests arrive or are processed

#### Updated: `ProfilesContext.tsx`
- Added real-time subscription to friendships table
- Listens for INSERT, UPDATE, DELETE on friendships where user is friend_id
- Automatically calls `fetchAllProfiles()` when friendship changes
- Ensures UI updates immediately when granted viewer/administrator access
- No manual refresh or page reload required

#### Updated: `FriendsManager.tsx`
- Removed manual notification creation code (now handled by database trigger)
- Simplified friend request sending logic
- Cleaned up accept/decline logic

## How It Works

### Friend Request Flow

1. **User sends friend request**
   - FriendsManager inserts row into `friend_requests` table
   - Database trigger fires: `create_friend_request_notification()`

2. **Notification created**
   - Trigger creates notification in `notifications` table
   - Includes requester name, message, and metadata

3. **Delivery triggered**
   - Second trigger fires: `deliver_notification()`
   - Sends push notification to all registered devices via FCM
   - Sends email notification via SendGrid

4. **Real-time updates**
   - Header subscription detects new friend_request row
   - Fetches updated count and displays red badge
   - User sees notification immediately

5. **User accepts request**
   - Friendships created in both directions
   - ProfilesContext subscription detects friendship change
   - Automatically refreshes profiles to show new access
   - UI updates without reload

### Visual Indicators

- **Red Badge**: Shows count of pending friend requests (highest priority)
- **Blue Badge**: Shows count of unread messages (when no friend requests)
- **Header Icon**: Users icon with badges for clear visibility

### Real-time Synchronization

All updates happen automatically through Supabase real-time subscriptions:
- Friend request count updates instantly
- Profile access updates when permissions granted
- No polling or manual refreshes required

## Technical Details

### Database Extensions Used
- `pg_net`: For async HTTP calls from database triggers

### Environment Variables Required
- `SENDGRID_API_KEY`: For email notifications (optional, falls back gracefully)
- `EMAIL_FROM_ADDRESS`: From address for emails (defaults to noreply@famsink.com)
- `SUPABASE_URL`: Stored in vault for trigger access
- `SUPABASE_SERVICE_ROLE_KEY`: Stored in vault for trigger access

### Security
- All trigger functions use SECURITY DEFINER
- Proper RLS policies already in place on notifications table
- Service role key used only for internal edge function calls
- Email addresses accessed securely through auth.users

## Testing Checklist

- [x] Database migrations applied successfully
- [x] Edge function deployed
- [x] Frontend builds without errors
- [ ] Test friend request push notification on device
- [ ] Test friend request email delivery
- [ ] Verify badge appears when friend request received
- [ ] Verify badge updates when friend request accepted/declined
- [ ] Verify profiles update automatically when granted access
- [ ] Test on both iOS and Android devices
- [ ] Test email notification formatting

## Known Limitations

1. Email notifications require SendGrid API key to be configured
2. Push notifications require FCM setup and device registration
3. Vault secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) may need to be configured

## Future Enhancements

1. Add user preference for email notifications on/off
2. Add notification sound customization
3. Add notification preview in notification center
4. Add badge for combined friend requests + messages count
5. Add notification history page
