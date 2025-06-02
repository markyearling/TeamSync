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

  constructor(config: TeamSnapConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
  }

  async initiateOAuth(): Promise<string> {
    try {
      // Generate PKCE challenge with 128 bytes of entropy
      const challenge = pkceChallenge(128);
      
      // Store code verifier securely in localStorage
      localStorage.setItem('teamsnap_code_verifier', challenge.code_verifier);
      
      // Build authorization URL with required parameters
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        code_challenge: challenge.code_challenge,
        code_challenge_method: 'S256',
        scope: 'read write'
      });

      const authUrl = `${TEAMSNAP_AUTH_URL}?${params.toString()}`;
      console.log('Initiating OAuth with URL:', authUrl);
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
        throw new Error('Code verifier not found in storage');
      }

      console.log('Exchanging code for token with verifier:', codeVerifier.substring(0, 10) + '...');

      // Build token request body
      const body = new URLSearchParams();
      body.append('client_id', this.clientId);
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', this.redirectUri);
      body.append('code_verifier', codeVerifier);

      // Exchange authorization code for token
      const response = await fetch(TEAMSNAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange failed:', {
          status: response.status,
          error: errorData
        });
        throw new Error(`Failed to get access token: ${errorData.error_description || 'Unknown error'}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Clean up stored verifier
      localStorage.removeItem('teamsnap_code_verifier');

      // Sync teams and events
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
      throw new Error(`API request failed: ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  async getTeams(): Promise<any> {
    return this.request('/teams');
  }

  async getTeamEvents(teamId: string): Promise<any> {
    return this.request(`/teams/${teamId}/events`);
  }

  private async syncTeamsAndEvents(): Promise<void> {
    try {
      const teamsData = await this.getTeams();
      
      if (!teamsData.collection?.items) {
        throw new Error('Invalid teams data received');
      }

      // For each team, store it in the platform_teams table
      for (const team of teamsData.collection.items) {
        const { data: platformTeam, error: teamError } = await supabase
          .from('platform_teams')
          .upsert({
            platform: 'TeamSnap',
            team_id: team.id,
            team_name: team.data.name,
            sport: team.data.sport || 'Unknown',
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

        // Fetch and store events for this team
        try {
          const eventsData = await this.getTeamEvents(team.id);
          if (eventsData.collection?.items) {
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
                  sport: team.data.sport || 'Unknown',
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
    } catch (error) {
      console.error('Error syncing teams and events:', error);
      throw error;
    }
  }
}

export default TeamSnapService;