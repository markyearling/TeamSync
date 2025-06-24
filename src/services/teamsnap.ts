import { generateCodeVerifier, generateCodeChallenge } from 'oauth-pkce';
import { supabase } from '../lib/supabase';

const TEAMSNAP_AUTH_URL = 'https://auth.teamsnap.com/oauth/authorize';
const TEAMSNAP_TOKEN_URL = 'https://auth.teamsnap.com/oauth/token';
const TEAMSNAP_API_URL = 'https://api.teamsnap.com/v3';

export interface TeamSnapConfig {
  clientId: string;
  redirectUri: string;
}

export class TeamSnapService {
  private clientId: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private readonly clientSecret = 'osTEt8nG9LVNoqEHX5GBw2FwxjBCYUijCLfo-H-ihaA';

  constructor(config: TeamSnapConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
  }

  async initiateOAuth(): Promise<string> {
    try {
      // Generate PKCE challenge
      const challenge = pkceChallenge();
      
      // Store code verifier in localStorage
      localStorage.setItem('teamsnap_code_verifier', challenge.code_verifier);
      
      // Build authorization URL
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        code_challenge: challenge.code_challenge,
        code_challenge_method: 'S256',
        scope: 'read write'
      });

      const authUrl = `${TEAMSNAP_AUTH_URL}?${params.toString()}`;
      console.log('Authorization URL:', authUrl);

      return authUrl;
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      throw new Error('Failed to initiate OAuth flow');
    }
  }

  async handleCallback(code: string): Promise<void> {
    try {
      // Retrieve stored code verifier
      const codeVerifier = localStorage.getItem('teamsnap_code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier not found');
      }

      // Prepare the request body
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      }).toString();

      console.log('Token exchange request to:', TEAMSNAP_TOKEN_URL);
      
      // Exchange code for token
      const tokenResponse = await fetch(TEAMSNAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Content-Length': body.length.toString()
        },
        body
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Token exchange error:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorData
        });
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }

      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token;

      console.log('Token exchange successful');

      // Store the access token securely for later use
      await this.storeAccessToken(tokenData.access_token, tokenData.refresh_token);

      // Clean up
      localStorage.removeItem('teamsnap_code_verifier');

      // Sync data using the proper API sequence
      await this.syncTeamsAndEvents();
    } catch (error) {
      console.error('Error in handleCallback:', error);
      throw error;
    }
  }

  private async storeAccessToken(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user');

      // Store tokens in user_settings table (you might want a separate tokens table for better security)
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          teamsnap_access_token: accessToken,
          teamsnap_refresh_token: refreshToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error storing access token:', error);
        // Don't throw here, continue with sync
      }
    } catch (error) {
      console.error('Error storing access token:', error);
    }
  }

  private async getStoredAccessToken(): Promise<string | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user');

      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('teamsnap_access_token')
        .eq('user_id', user.id)
        .single();

      if (error || !settings?.teamsnap_access_token) {
        return null;
      }

      return settings.teamsnap_access_token;
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    // Try to use stored access token if current one is null
    if (!this.accessToken) {
      this.accessToken = await this.getStoredAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated - please reconnect to TeamSnap');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${TEAMSNAP_API_URL}${endpoint}`;
    console.log('Making API request to:', url);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        response: errorText
      });
      
      // If unauthorized, clear the stored token
      if (response.status === 401) {
        this.accessToken = null;
        await this.clearStoredTokens();
        throw new Error('Authentication expired - please reconnect to TeamSnap');
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`API response from ${url}:`, data);
    return data;
  }

  private async clearStoredTokens(): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      await supabase
        .from('user_settings')
        .update({
          teamsnap_access_token: null,
          teamsnap_refresh_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error clearing stored tokens:', error);
    }
  }

  async getUserId(): Promise<string> {
    try {
      console.log('Step 1: Fetching user ID from /me endpoint');
      const meResponse = await this.request('/me');

      console.log('The meResponse is: ', meResponse);
      
      // Handle different possible response structures
      let userId: string | null = null;

      // Check if response has a direct id field
      if (meResponse.id) {
        userId = meResponse.id.toString();
      }
      // Check if response has data array structure
      else if (meResponse.data && Array.isArray(meResponse.data)) {
        const idField = meResponse.data.find((field: any) => field.name === 'id');
        if (idField && idField.value) {
          userId = idField.value.toString();
        }
      }
      // Check if response has collection structure
      else if (meResponse.collection && meResponse.collection.items && Array.isArray(meResponse.collection.items)) {
        const userItem = meResponse.collection.items[0];
        if (userItem && userItem.data) {
          const idField = userItem.data.find((field: any) => field.name === 'id');
          if (idField && idField.value) {
            userId = idField.value.toString();
          }
        }
      }
      // Check if response is an array directly
      else if (Array.isArray(meResponse)) {
        const idField = meResponse.find((field: any) => field.name === 'id');
        if (idField && idField.value) {
          userId = idField.value.toString();
        }
      }

      if (!userId) {
        console.error('Could not extract user ID from response:', meResponse);
        throw new Error('User ID not found in /me response. Response structure may have changed.');
      }

      console.log('User ID obtained:', userId);
      return userId;
    } catch (error) {
      console.error('Error fetching user ID:', error);
      throw error;
    }
  }

  async getActiveTeams(userId: string): Promise<any[]> {
    try {
      console.log(`Step 2: Fetching active teams for user ID: ${userId}`);
      const teamsResponse = await this.request(`/teams/active?user_id=${userId}`);
      
      // Handle different possible response structures
      let teams: any[] = [];

      if (Array.isArray(teamsResponse)) {
        teams = teamsResponse;
      } else if (teamsResponse.collection && Array.isArray(teamsResponse.collection.items)) {
        teams = teamsResponse.collection.items.map((item: any) => {
          // Extract team data from the item structure
          if (item.data && Array.isArray(item.data)) {
            const teamObj: any = {};
            item.data.forEach((field: any) => {
              if (field.name && field.value !== undefined) {
                teamObj[field.name] = field.value;
              }
            });
            return teamObj;
          }
          return item;
        });
      } else if (teamsResponse.data && Array.isArray(teamsResponse.data)) {
        teams = teamsResponse.data;
      }

      console.log(`Found ${teams.length} active teams`);
      return teams;
    } catch (error) {
      console.error('Error fetching active teams:', error);
      throw error;
    }
  }

  async getTeamEvents(teamId: string): Promise<any[]> {
    try {
      console.log(`Step 3: Fetching events for team ID: ${teamId}`);
      const eventsResponse = await this.request(`/events/search?team_id=${teamId}`);
      
      // Handle different possible response structures
      let events: any[] = [];

      if (Array.isArray(eventsResponse)) {
        events = eventsResponse;
      } else if (eventsResponse.collection && Array.isArray(eventsResponse.collection.items)) {
        events = eventsResponse.collection.items.map((item: any) => {
          // Extract event data from the item structure
          if (item.data && Array.isArray(item.data)) {
            const eventObj: any = {};
            item.data.forEach((field: any) => {
              if (field.name && field.value !== undefined) {
                eventObj[field.name] = field.value;
              }
            });
            return eventObj;
          }
          return item;
        });
      } else if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
        events = eventsResponse.data;
      }

      console.log(`Found ${events.length} events for team ${teamId}`);
      return events;
    } catch (error) {
      console.error('Error fetching team events:', error);
      throw error;
    }
  }

  private async syncTeamsAndEvents(): Promise<void> {
    try {
      console.log('Starting TeamSnap sync process...');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user');

      // Step 1: Get user ID
      const userId = await this.getUserId();
      
      // Step 2: Get active teams
      const activeTeams = await this.getActiveTeams(userId);
      
      if (activeTeams.length === 0) {
        console.log('No active teams found for user');
        return;
      }

      // Step 3: For each team, store it (but don't store events yet)
      for (const team of activeTeams) {
        console.log(`Processing team: ${team.name} (ID: ${team.id})`);
        
        // Store team in platform_teams table
        const { data: platformTeam, error: teamError } = await supabase
          .from('platform_teams')
          .upsert({
            platform: 'TeamSnap',
            team_id: team.id.toString(),
            team_name: team.name,
            sport: team.sport || 'Unknown',
            sync_status: 'success',
            last_synced: new Date().toISOString(),
            user_id: user.id
          }, {
            onConflict: 'platform,team_id'
          })
          .select()
          .single();

        if (teamError) {
          console.error('Error storing team:', teamError);
          continue;
        }

        console.log(`Successfully stored team: ${team.name}`);

        // Note: We don't sync events here anymore since they need to be mapped to profiles first
        // Events will be synced when the user maps teams to profiles and manually refreshes
      }

      console.log('TeamSnap team sync process completed successfully');
      console.log('Note: Events will be synced when teams are mapped to profiles');
    } catch (error) {
      console.error('Error in syncTeamsAndEvents:', error);
      throw error;
    }
  }

  // New method to sync events for a specific team and profile
  async syncEventsForTeamAndProfile(teamId: string, profileId: string): Promise<number> {
    try {
      console.log(`Syncing events for team ${teamId} and profile ${profileId}`);
      
      // Get the platform team record
      const { data: platformTeam, error: teamError } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('id', teamId)
        .eq('platform', 'TeamSnap')
        .single();

      if (teamError || !platformTeam) {
        throw new Error('Platform team not found');
      }

      // Fetch events from TeamSnap API
      const teamEvents = await this.getTeamEvents(platformTeam.team_id);
      
      if (teamEvents.length === 0) {
        console.log('No events found for this team');
        return 0;
      }

      // Transform and store events for the specific profile
      const eventsToInsert = teamEvents.map(event => {
        // Format the title based on event type and is_game flag
        let title = 'TeamSnap Event';
        
        if (event.type) {
          // Capitalize the first letter of the event type
          title = event.type.charAt(0).toUpperCase() + event.type.slice(1);
          
          // If it's a game, append "Game" to the type
          if (event.is_game) {
            title += " Game";
          }
        } else if (event.is_game) {
          // If there's no type but it is a game
          title = "Game";
        } else if (event.name) {
          // Fall back to the event name if available
          title = event.name;
        }

        // Use formatted_title_for_multi_team for description if available
        let description = '';
        if (event.formatted_title_for_multi_team) {
          description = event.formatted_title_for_multi_team;
        } else if (event.notes) {
          description = event.notes;
        }

        return {
          title: title,
          description: description,
          start_time: event.start_date,
          end_time: event.end_date || event.start_date,
          location: event.location_name || '',
          sport: platformTeam.sport || 'Unknown',
          color: '#7C3AED', // TeamSnap purple
          platform: 'TeamSnap',
          platform_color: '#7C3AED',
          platform_team_id: teamId,
          profile_id: profileId // This is the key - we now have a valid profile_id
        };
      }).filter(event => event.start_time); // Only include events with valid start times

      if (eventsToInsert.length === 0) {
        console.log('No valid events to insert');
        return 0;
      }

      // Delete existing events for this profile and team to avoid duplicates
      await supabase
        .from('events')
        .delete()
        .eq('platform_team_id', teamId)
        .eq('profile_id', profileId)
        .eq('platform', 'TeamSnap');

      // Insert new events
      const { error: eventsError } = await supabase
        .from('events')
        .insert(eventsToInsert);

      if (eventsError) {
        console.error('Error storing events:', eventsError);
        throw eventsError;
      }

      console.log(`Successfully stored ${eventsToInsert.length} events for profile ${profileId}`);
      return eventsToInsert.length;
    } catch (error) {
      console.error('Error syncing events for team and profile:', error);
      throw error;
    }
  }

  // Method to sync events for all mapped profiles of a team
  async syncEventsForTeam(teamId: string): Promise<number> {
    try {
      console.log(`Syncing events for team ${teamId}`);
      
      // Get all profile mappings for this team
      const { data: profileMappings, error: mappingError } = await supabase
        .from('profile_teams')
        .select('profile_id')
        .eq('platform_team_id', teamId);

      if (mappingError) {
        throw mappingError;
      }

      if (!profileMappings || profileMappings.length === 0) {
        throw new Error('No profiles mapped to this team');
      }

      let totalEvents = 0;
      
      // Sync events for each mapped profile
      for (const mapping of profileMappings) {
        const eventCount = await this.syncEventsForTeamAndProfile(teamId, mapping.profile_id);
        totalEvents += eventCount;
      }

      // Update team sync status
      await supabase
        .from('platform_teams')
        .update({
          sync_status: 'success',
          last_synced: new Date().toISOString()
        })
        .eq('id', teamId);

      return totalEvents;
    } catch (error) {
      console.error('Error syncing events for team:', error);
      
      // Update team sync status to error
      await supabase
        .from('platform_teams')
        .update({
          sync_status: 'error',
          last_synced: new Date().toISOString()
        })
        .eq('id', teamId);
      
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  async getTeams(): Promise<any> {
    const userId = await this.getUserId();
    const activeTeams = await this.getActiveTeams(userId);
    
    return {
      collection: {
        items: activeTeams.map(team => ({
          data: {
            id: team.id,
            name: team.name,
            sport_name: team.sport,
            active: true
          }
        }))
      }
    };
  }
}

export default TeamSnapService;