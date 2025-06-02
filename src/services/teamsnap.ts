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
  private readonly clientSecret = 'v3MnBMysXsfisUjXdKvMXFOwSZDeL44Rj4Ht8qjp5wk';

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

      return `${TEAMSNAP_AUTH_URL}?${params.toString()}`;
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

      console.log('Exchanging code for token...');
      
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
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }

      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token;

      console.log('Successfully obtained access token');

      // Clean up
      localStorage.removeItem('teamsnap_code_verifier');

      // Sync data
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

    console.log(`Making API request to: ${endpoint}`);

    const response = await fetch(`${TEAMSNAP_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API request failed:', {
        endpoint,
        status: response.status,
        error: errorData
      });
      throw new Error(`API request failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log(`API response from ${endpoint}:`, data);
    return data;
  }

  async getTeams(): Promise<any> {
    try {
      console.log('Fetching teams...');
      
      // First get the user's memberships
      console.log('Fetching user memberships...');
      const membershipsResponse = await this.request('/members/me');
      console.log('Memberships response:', membershipsResponse);

      if (!membershipsResponse.collection?.items) {
        console.log('No memberships found');
        return { collection: { items: [] } };
      }

      // Extract team IDs from memberships
      const teamIds = membershipsResponse.collection.items
        .filter((member: any) => member.data.active)
        .map((member: any) => member.data.team_id);

      console.log('Found team IDs:', teamIds);

      if (teamIds.length === 0) {
        console.log('No active team memberships found');
        return { collection: { items: [] } };
      }

      // Fetch details for each team
      console.log('Fetching team details...');
      const teamsPromises = teamIds.map(teamId => {
        console.log(`Fetching details for team ${teamId}`);
        return this.request(`/teams/${teamId}`);
      });

      const teamsResponses = await Promise.all(teamsPromises);
      
      // Combine all team data
      const activeTeams = teamsResponses
        .filter(response => response.collection?.items?.[0])
        .map(response => response.collection.items[0])
        .filter(team => team.data.active !== false);

      console.log('Active teams:', activeTeams);

      return {
        collection: {
          items: activeTeams
        }
      };
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw error;
    }
  }

  async getTeamEvents(teamId: string): Promise<any> {
    console.log(`Fetching events for team ${teamId}`);
    return this.request(`/teams/${teamId}/events`);
  }

  private async syncTeamsAndEvents(): Promise<void> {
    try {
      console.log('Starting teams and events sync...');
      const teamsData = await this.getTeams();
      
      if (!teamsData.collection?.items) {
        throw new Error('Invalid teams data received');
      }

      console.log(`Found ${teamsData.collection.items.length} teams to sync`);

      // For each team, store it in the platform_teams table
      for (const team of teamsData.collection.items) {
        console.log(`Syncing team: ${team.data.name}`);
        
        const { data: platformTeam, error: teamError } = await supabase
          .from('platform_teams')
          .upsert({
            platform: 'TeamSnap',
            team_id: team.data.id,
            team_name: team.data.name,
            sport: team.data.sport_name || 'Unknown',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'platform,team_id'
          })
          .select()
          .single();

        if (teamError) {
          console.error('Error syncing team:', teamError);
          continue;
        }

        console.log(`Successfully synced team: ${team.data.name}`);

        // Fetch and store events for this team
        try {
          console.log(`Fetching events for team: ${team.data.name}`);
          const eventsData = await this.getTeamEvents(team.data.id);
          if (eventsData.collection?.items) {
            console.log(`Found ${eventsData.collection.items.length} events for team ${team.data.name}`);
            for (const event of eventsData.collection.items) {
              const { error: eventError } = await supabase
                .from('events')
                .upsert({
                  platform: 'TeamSnap',
                  platform_team_id: platformTeam.id,
                  title: event.data.name,
                  description: event.data.notes,
                  start_time: event.data.start_date,
                  end_time: event.data.end_date,
                  location: event.data.location,
                  sport: team.data.sport_name || 'Unknown',
                  color: '#7C3AED', // TeamSnap purple
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'platform,platform_team_id,start_time,end_time'
                });

              if (eventError) {
                console.error('Error syncing event:', eventError);
              }
            }
          }
        } catch (eventError) {
          console.error('Error fetching team events:', eventError);
        }
      }

      console.log('Teams and events sync completed');
    } catch (error) {
      console.error('Error syncing teams and events:', error);
      throw error;
    }
  }
}

export default TeamSnapService;