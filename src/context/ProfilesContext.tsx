import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, testConnection } from '../lib/supabase';
import { Child } from '../types';

interface ProfilesContextType {
  profiles: Child[];
  friendsProfiles: Child[];
  allProfiles: Child[];
  addProfile: (profile: Omit<Child, 'id'>) => Promise<void>;
  updateProfile: (id: string, profile: Partial<Child>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  getProfile: (id: string) => Promise<Child>;
  loading: boolean;
  error: string | null;
}

const ProfilesContext = createContext<ProfilesContextType | undefined>(undefined);

export const useProfiles = () => {
  const context = useContext(ProfilesContext);
  if (!context) {
    throw new Error('useProfiles must be used within a ProfilesProvider');
  }
  return context;
};

interface ProfilesProviderProps {
  children: ReactNode;
}

export const ProfilesProvider: React.FC<ProfilesProviderProps> = ({ children }) => {
  const [profiles, setProfiles] = useState<Child[]>([]);
  const [friendsProfiles, setFriendsProfiles] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Combine own profiles and friends' profiles
  const allProfiles = [...profiles, ...friendsProfiles];

  useEffect(() => {
    let mounted = true;

    const initializeConnection = async () => {
      try {
        const isConnected = await testConnection();
        if (!isConnected) {
          throw new Error('Failed to establish connection with Supabase');
        }
        
        if (mounted) {
          const subscription = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              if (session?.user) {
                fetchAllProfiles();
              }
            } else if (event === 'SIGNED_OUT') {
              setProfiles([]);
              setFriendsProfiles([]);
            }
          });

          // Initial fetch only if we have a session
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await fetchAllProfiles();
          }

          return () => {
            subscription.data.subscription.unsubscribe();
          };
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Supabase connection';
          setError(errorMessage);
          console.error('Connection initialization error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeConnection();

    return () => {
      mounted = false;
    };
  }, []);

  const fetchAllProfiles = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      if (!user) {
        setProfiles([]);
        setFriendsProfiles([]);
        return;
      }

      // Fetch own profiles
      await fetchOwnProfiles(user.id);
      
      // Fetch friends' profiles where user has administrator access
      await fetchFriendsProfiles(user.id);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profiles';
      setError(errorMessage);
      console.error('Error fetching profiles:', err);
      setProfiles([]);
      setFriendsProfiles([]);
    }
  };

  const fetchOwnProfiles = async (userId: string) => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        age,
        color,
        photo_url,
        notes,
        user_id,
        profile_sports (
          sport,
          color
        )
      `)
      .eq('user_id', userId);

    if (profilesError) throw profilesError;

    const formattedProfiles: Child[] = profilesData?.map(profile => ({
      id: profile.id,
      name: profile.name,
      age: profile.age,
      color: profile.color,
      photo_url: profile.photo_url,
      notes: profile.notes,
      sports: profile.profile_sports?.map(sport => ({
        name: sport.sport,
        color: sport.color
      })) || [],
      eventCount: 0,
      isOwnProfile: true
    })) || [];

    setProfiles(formattedProfiles);
  };

  const fetchFriendsProfiles = async (userId: string) => {
    try {
      // Get friendships where current user has administrator access to friends
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id, role')
        .eq('user_id', userId)
        .eq('role', 'administrator');

      if (friendshipsError) throw friendshipsError;

      if (!friendships || friendships.length === 0) {
        setFriendsProfiles([]);
        return;
      }

      const friendUserIds = friendships.map(f => f.friend_id);

      // Get user settings for friends
      const { data: userSettings, error: userSettingsError } = await supabase
        .from('user_settings')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', friendUserIds);

      if (userSettingsError) throw userSettingsError;

      // Get all profiles for friends where user has administrator access
      const { data: friendProfilesData, error: friendProfilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          age,
          color,
          photo_url,
          notes,
          user_id,
          profile_sports (
            sport,
            color
          )
        `)
        .in('user_id', friendUserIds);

      if (friendProfilesError) throw friendProfilesError;

      const formattedFriendsProfiles: Child[] = friendProfilesData?.map(profile => {
        const userSetting = userSettings?.find(us => us.user_id === profile.user_id);
        
        return {
          id: profile.id,
          name: profile.name,
          age: profile.age,
          color: profile.color,
          photo_url: profile.photo_url,
          notes: profile.notes,
          sports: profile.profile_sports?.map(sport => ({
            name: sport.sport,
            color: sport.color
          })) || [],
          eventCount: 0,
          isOwnProfile: false,
          ownerName: userSetting?.full_name || 'Friend',
          ownerPhoto: userSetting?.profile_photo_url
        };
      }) || [];

      setFriendsProfiles(formattedFriendsProfiles);
    } catch (err) {
      console.error('Error fetching friends profiles:', err);
      setFriendsProfiles([]);
    }
  };

  const getProfile = async (id: string): Promise<Child> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('No authenticated user');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          age,
          color,
          photo_url,
          notes,
          user_id,
          profile_sports (
            sport,
            color
          )
        `)
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      // Check if this is a friend's profile
      const isOwnProfile = profile.user_id === user.id;
      let ownerName = undefined;
      let ownerPhoto = undefined;

      if (!isOwnProfile) {
        // Get owner information
        const { data: ownerSettings } = await supabase
          .from('user_settings')
          .select('full_name, profile_photo_url')
          .eq('user_id', profile.user_id)
          .single();

        ownerName = ownerSettings?.full_name || 'Friend';
        ownerPhoto = ownerSettings?.profile_photo_url;
      }

      return {
        id: profile.id,
        name: profile.name,
        age: profile.age,
        color: profile.color,
        photo_url: profile.photo_url,
        notes: profile.notes,
        sports: profile.profile_sports?.map(sport => ({
          name: sport.sport,
          color: sport.color
        })) || [],
        eventCount: 0,
        isOwnProfile,
        ownerName,
        ownerPhoto
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch profile');
    }
  };

  const addProfile = async (profile: Omit<Child, 'id'>) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('No authenticated user');

      // Insert profile
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          name: profile.name,
          age: profile.age,
          color: profile.color,
          photo_url: profile.photo_url,
          notes: profile.notes,
          user_id: user.id
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Insert sports
      if (profile.sports?.length > 0) {
        const { error: sportsError } = await supabase
          .from('profile_sports')
          .insert(
            profile.sports.map(sport => ({
              profile_id: newProfile.id,
              sport: sport.name,
              color: sport.color
            }))
          );

        if (sportsError) throw sportsError;
      }

      await fetchAllProfiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add profile';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProfile = async (id: string, profile: Partial<Child>) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('No authenticated user');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          age: profile.age,
          color: profile.color,
          photo_url: profile.photo_url,
          notes: profile.notes
        })
        .eq('id', id);

      if (profileError) throw profileError;

      if (profile.sports) {
        // Delete existing sports
        await supabase
          .from('profile_sports')
          .delete()
          .eq('profile_id', id);

        // Insert new sports
        if (profile.sports.length > 0) {
          const { error: sportsError } = await supabase
            .from('profile_sports')
            .insert(
              profile.sports.map(sport => ({
                profile_id: id,
                sport: sport.name,
                color: sport.color
              }))
            );

          if (sportsError) throw sportsError;
        }
      }

      await fetchAllProfiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update both own profiles and friends profiles
      setProfiles(profiles.filter(p => p.id !== id));
      setFriendsProfiles(friendsProfiles.filter(p => p.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete profile';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <ProfilesContext.Provider
      value={{
        profiles,
        friendsProfiles,
        allProfiles,
        addProfile,
        updateProfile,
        deleteProfile,
        getProfile,
        loading,
        error
      }}
    >
      {children}
    </ProfilesContext.Provider>
  );
};