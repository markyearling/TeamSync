import { generateCodeVerifier, generateCodeChallenge } from 'oauth-pkce';

const SPORTSENGINE_AUTH_URL = 'https://user.sportngin.com/oauth/authorize';
const SPORTSENGINE_TOKEN_URL = 'https://user.sportngin.com/oauth/token';
const SPORTSENGINE_API_URL = 'https://api.sportngin.com/v3';

export interface SportsEngineConfig {
  clientId: string;
  redirectUri: string;
}

class SportsEngineService {
  private clientId: string;
  private redirectUri: string;
  private codeVerifier: string;
  private accessToken: string | null = null;

  constructor(config: SportsEngineConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
    this.codeVerifier = generateCodeVerifier();
  }

  async initiateOAuth(): Promise<string> {
    const codeChallenge = await generateCodeChallenge(this.codeVerifier);
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'leagues teams games'
    });

    return `${SPORTSENGINE_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: this.codeVerifier
    });

    const response = await fetch(SPORTSENGINE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('Failed to get access token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  async getLeagues(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SPORTSENGINE_API_URL}/leagues`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leagues');
    }

    return response.json();
  }

  async getTeams(leagueId: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SPORTSENGINE_API_URL}/leagues/${leagueId}/teams`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch teams');
    }

    return response.json();
  }

  async getGames(teamId: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SPORTSENGINE_API_URL}/teams/${teamId}/games`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }

    return response.json();
  }
}

export default SportsEngineService;