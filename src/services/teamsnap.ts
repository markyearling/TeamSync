import pkceChallenge from 'pkce-challenge';
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

      // Clean up
      localStorage.removeItem('teamsnap_code_verifier');

      // Sync data using the proper API sequence
      await this.syncTeamsAndEvents();
    } catch (error) {
      console.error('Error in handleCallback:', error);
      throw error;
    }
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`API response from ${url}:`, data);
    return data;
  }

  async getUserId(): Promise<string> {
    try {
      console.log('Step 1: Fetching user ID from /me endpoint');
      const meResponse = await this.request('/me');

       console.log('The mResponse is: ', meResponse.data);
      // Parse the user ID from the data array structure
      if (!meResponse.data || !Array.isArray(meResponse.data)) {
        throw new Error('Invalid /me response structure - missing data array');
      }

      // Find the id field in the data array
      const idField = meResponse.data.find((field: any) => field.name === 'id');
      console.log('idField is: ', idField, ' and ifField.alue is: ', idField.value);
      
      if (!idField || !idField.value) {
        throw new Error('User ID not found in /me response data');
      }

      const userId = idField.value.toString();
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
      
      if (!Array.isArray(teamsResponse)) {
        throw new Error('Invalid teams response format');
      }

      console.log(`Found ${teamsResponse.length} active teams`);
      return teamsResponse;
    } catch (error) {
      console.error('Error fetching active teams:', error);
      throw error;
    }
  }

  async getTeamEvents(teamId: string): Promise<any[]> {
    try {
      console.log(`Step 3: Fetching events for team ID: ${teamId}`);
      const eventsResponse = await this.request(`/events/search?team_id=${teamId}`);
      
      if (!Array.isArray(eventsResponse)) {
        throw new Error('Invalid events response format');
      }

      console.log(`Found ${eventsResponse.length} events for team ${teamId}`);
      return eventsResponse;
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

      // Step 3: For each team, store it and fetch its events
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

        // Step 4: Fetch and store events for this team
        try {
          const teamEvents = await this.getTeamEvents(team.id.toString());
          
          if (teamEvents.length > 0) {
            console.log(`Processing ${teamEvents.length} events for team ${team.name}`);
            
            // Transform and store events
            const eventsToInsert = teamEvents.map(event => ({
              title: event.name || 'TeamSnap Event',
              description: event.notes || '',
              start_time: event.start_date,
              end_time: event.end_date || event.start_date,
              location: event.location_name || '',
              sport: team.sport || 'Unknown',
              color: '#7C3AED', // TeamSnap purple
              platform: 'TeamSnap',
              platform_color: '#7C3AED',
              platform_team_id: platformTeam.id,
              profile_id: null // Will be set when user maps teams to profiles
            })).filter(event => event.start_time); // Only include events with valid start times

            if (eventsToInsert.length > 0) {
              // Delete existing events for this team to avoid duplicates
              await supabase
                .from('events')
                .delete()
                .eq('platform_team_id', platformTeam.id)
                .eq('platform', 'TeamSnap');

              // Insert new events
              const { error: eventsError } = await supabase
                .from('events')
                .insert(eventsToInsert);

              if (eventsError) {
                console.error('Error storing events:', eventsError);
              } else {
                console.log(`Successfully stored ${eventsToInsert.length} events for team ${team.name}`);
              }
            }
          }
        } catch (eventError) {
          console.error(`Error processing events for team ${team.name}:`, eventError);
          
          // Update team sync status to error
          await supabase
            .from('platform_teams')
            .update({
              sync_status: 'error',
              last_synced: new Date().toISOString()
            })
            .eq('id', platformTeam.id);
        }
      }

      console.log('TeamSnap sync process completed successfully');
    } catch (error) {
      console.error('Error in syncTeamsAndEvents:', error);
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