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
  private codeVerifier: string;
  private accessToken: string | null = null;

  constructor(config: TeamSnapConfig) {
    this.clientId = config.clientId;
    this.redirectUri = `${window.location.origin}/connections/teamsnap/callback`;
    const challenge = pkceChallenge();
    this.codeVerifier = challenge.code_verifier;
  }

  async initiateOAuth(): Promise<string> {
    const challenge = pkceChallenge();
    this.codeVerifier = challenge.code_verifier;
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      code_challenge: challenge.code_challenge,
      code_challenge_method: 'S256',
      scope: 'read write'
    });

    const authUrl = `${TEAMSNAP_AUTH_URL}?${params.toString()}`;
    return authUrl;
  }

  async handleCallback(code: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        code_verifier: this.codeVerifier
      });

      const response = await fetch(TEAMSNAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get access token: ${errorData.error_description || 'Unknown error'}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // After getting the access token, fetch and store teams
      await this.syncTeams();
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

  private async syncTeams(): Promise<void> {
    try {
      const teamsData = await this.getTeams();
      
      if (!teamsData.collection?.items) {
        throw new Error('Invalid teams data received');
      }

      // For each team, store it in the platform_teams table
      for (const team of teamsData.collection.items) {
        const { error } = await supabase
          .from('platform_teams')
          .upsert({
            platform: 'TeamSnap',
            team_id: team.id,
            team_name: team.data.name,
            sport: team.data.sport || 'Unknown',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'platform,team_id'
          });

        if (error) {
          console.error('Error syncing team:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error syncing teams:', error);
      throw error;
    }
  }
}

export default TeamSnapService;