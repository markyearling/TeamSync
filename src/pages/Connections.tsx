import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ExternalLink,
  Lock,
  Calendar,
  Users,
  BarChart,
  Link as LinkIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Platform } from '../types';

const Connections: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [connectionStep, setConnectionStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Available platforms that can be connected
  const availablePlatforms: Platform[] = [
    {
      id: 1,
      name: 'SportsEngine',
      icon: Calendar,
      color: '#2563EB',
      connected: false,
      hasIssue: false,
    },
    {
      id: 2,
      name: 'TeamSnap',
      icon: Users,
      color: '#7C3AED',
      connected: false,
      hasIssue: false,
    },
    {
      id: 3,
      name: 'PlayMetrics',
      icon: BarChart,
      color: '#10B981',
      connected: false,
      hasIssue: false,
    },
    {
      id: 4,
      name: 'GameChanger',
      icon: LinkIcon,
      color: '#F97316',
      connected: false,
      hasIssue: false,
    }
  ];

  useEffect(() => {
    const fetchConnectedPlatforms = async () => {
      try {
        // Get distinct platforms from platform_teams table using a modified query
        const { data: connectedPlatformsData, error } = await supabase
          .from('platform_teams')
          .select('platform')
          .limit(1000); // Add a reasonable limit

        if (error) throw error;

        // Get unique platform names using Set
        const uniquePlatforms = [...new Set(connectedPlatformsData.map(p => p.platform))];

        // Map the connected platforms to our platform objects
        const connectedPlatforms = availablePlatforms.map(platform => ({
          ...platform,
          connected: uniquePlatforms.includes(platform.name)
        }));

        setPlatforms(connectedPlatforms);
      } catch (error) {
        console.error('Error fetching connected platforms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedPlatforms();
  }, []);
  
  const handleConnect = (platformId: number) => {
    setConnecting(platformId);
    setConnectionStep(1);
  };
  
  const handleDisconnect = async (platformId: number) => {
    try {
      const platform = platforms.find(p => p.id === platformId);
      if (!platform) return;

      // Delete all teams for this platform
      await supabase
        .from('platform_teams')
        .delete()
        .eq('platform', platform.name);

      // Update local state
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, connected: false } : p
      ));

      setConnecting(null);
    } catch (error) {
      console.error('Error disconnecting platform:', error);
    }
  };
  
  const handleRefresh = async (platformId: number) => {
    // This would re-fetch data from the platform in a real app
    console.log(`Refreshing platform ${platformId}`);
  };
  
  const nextStep = () => {
    if (connectionStep < 3) {
      setConnectionStep(connectionStep + 1);
    } else {
      // Connection complete
      setConnecting(null);
      setConnectionStep(1);
    }
  };
  
  const getPlatformBenefits = (platformName: string) => {
    switch (platformName) {
      case 'SportsEngine':
        return [
          'Access to team schedules and game information',
          'Import practice times and locations',
          'Get real-time updates for schedule changes',
          'View coach announcements and team messages'
        ];
      case 'TeamSnap':
        return [
          'Sync team availability and roster information',
          'Import game and practice schedules',
          'Receive automated notifications for changes',
          'Access team photos and media'
        ];
      case 'PlayMetrics':
        return [
          'Import practice plans and development goals',
          'Track player performance and statistics',
          'Access coach feedback and evaluations',
          'Monitor skill development progress'
        ];
      case 'GameChanger':
        return [
          'Sync game schedules and tournament information',
          'Import statistics and game results',
          'Access video highlights and replays',
          'Receive live game updates'
        ];
      default:
        return [
          'Sync schedules and events automatically',
          'Receive real-time updates for changes',
          'Import all team information',
          'Streamline your sports management'
        ];
    }
  };
  
  const getConnectionStatus = (platform: Platform) => {
    if (platform.connected) {
      return platform.hasIssue ? (
        <div className="flex items-center text-yellow-600">
          <AlertTriangle className="h-5 w-5 mr-1" />
          <span>Connection issue</span>
        </div>
      ) : (
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-5 w-5 mr-1" />
          <span>Connected</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-gray-500">
        <XCircle className="h-5 w-5 mr-1" />
        <span>Not connected</span>
      </div>
    );
  };
  
  const renderConnectionDialog = () => {
    if (connecting === null) return null;
    
    const platform = platforms.find(p => p.id === connecting);
    if (!platform) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <div 
                className="h-10 w-10 rounded-lg flex items-center justify-center mr-3"
                style={{ backgroundColor: platform.color + '20', color: platform.color }}
              >
                <platform.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{platform.connected ? 'Manage' : 'Connect to'} {platform.name}</h3>
            </div>
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setConnecting(null)}
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          {platform.connected ? (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center text-green-600 mb-2">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Connected to {platform.name}</span>
                </div>
                <p className="text-gray-600">
                  Your {platform.name} account is currently connected and syncing data to TeamSync.
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Connection Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Connected on</span>
                    <span className="text-gray-900">June 15, 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last synced</span>
                    <span className="text-gray-900">Today at 10:23 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={platform.hasIssue ? "text-yellow-600" : "text-green-600"}>
                      {platform.hasIssue ? "Connection issue" : "Active"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button
                  className="w-full py-2 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                  onClick={() => handleRefresh(platform.id)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Connection
                </button>
                <button
                  className="w-full py-2 px-4 rounded-md border border-red-300 bg-white text-red-600 hover:bg-red-50 flex items-center justify-center"
                  onClick={() => handleDisconnect(platform.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {connectionStep === 1 && (
                <div>
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Connect to {platform.name}</h4>
                    <p className="text-gray-600">
                      Connecting to {platform.name} allows TeamSync to automatically import all your schedules, 
                      events, and team information.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-blue-800 mb-2">Benefits</h4>
                    <ul className="space-y-2 text-sm text-blue-700">
                      {getPlatformBenefits(platform.name).map((benefit, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">What you'll need</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs mr-2 flex-shrink-0">1</span>
                        <span>An active {platform.name} account</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs mr-2 flex-shrink-0">2</span>
                        <span>Your login credentials</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs mr-2 flex-shrink-0">3</span>
                        <span>Permission to access your team data</span>
                      </li>
                    </ul>
                  </div>
                  
                  <button
                    className="w-full py-2 px-4 rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center"
                    onClick={nextStep}
                  >
                    Continue
                  </button>
                </div>
              )}
              
              {connectionStep === 2 && (
                <div>
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Sign in to {platform.name}</h4>
                    <p className="text-gray-600">
                      You'll be redirected to {platform.name} to authorize TeamSync to access your account.
                    </p>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your password"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 mb-6">
                    <Lock className="h-4 w-4 mr-2" />
                    <span>Your credentials are securely transmitted to {platform.name}</span>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      className="flex-1 py-2 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      onClick={() => setConnectionStep(1)}
                    >
                      Back
                    </button>
                    <button
                      className="flex-1 py-2 px-4 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      onClick={nextStep}
                    >
                      Authorize
                    </button>
                  </div>
                </div>
              )}
              
              {connectionStep === 3 && (
                <div>
                  <div className="flex flex-col items-center justify-center py-6">
                    <div 
                      className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: platform.color + '20', color: platform.color }}
                    >
                      <CheckCircle className="h-10 w-10" />
                    </div>
                    <h4 className="text-xl font-medium text-gray-900 mb-2">Connection Successful!</h4>
                    <p className="text-gray-600 text-center mb-6">
                      Your {platform.name} account has been successfully connected to TeamSync.
                    </p>
                    
                    <div className="bg-green-50 p-4 rounded-lg w-full mb-6">
                      <h5 className="font-medium text-green-800 mb-2">What's Next</h5>
                      <ul className="space-y-2 text-sm text-green-700">
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                          <span>Your events are being imported (this may take a few minutes)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                          <span>You'll receive notifications for any scheduling conflicts</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                          <span>All future updates will sync automatically</span>
                        </li>
                      </ul>
                    </div>
                    
                    <button
                      className="w-full py-2 px-4 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      onClick={nextStep}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 sm:mb-0">Connections</h1>
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Connection
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Connected Platforms</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your connections to sports platforms and services
          </p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {platforms.filter(p => p.connected).map(platform => (
            <div key={platform.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center mb-4 sm:mb-0 sm:mr-4"
                  style={{ backgroundColor: platform.color + '20', color: platform.color }}
                >
                  <platform.icon className="h-6 w-6" />
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{platform.name}</h3>
                    {getConnectionStatus(platform)}
                  </div>
                  
                  <p className="text-gray-600 mb-4">
                    {platform.hasIssue 
                      ? `There is an issue with your ${platform.name} connection. Please refresh or reconnect.` 
                      : `Your ${platform.name} account is connected and syncing data to TeamSync.`}
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      onClick={() => handleConnect(platform.id)}
                    >
                      Manage
                    </button>
                    
                    <button
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      onClick={() => handleRefresh(platform.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      Refresh
                    </button>
                    
                    {platform.hasIssue && (
                      <div className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1.5 rounded-full flex items-center">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                        Connection issue
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {platforms.filter(p => p.connected).length === 0 && (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <LinkIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No platforms connected</h3>
              <p className="mt-1 text-gray-500">Connect to your sports platforms to start syncing data</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Available Platforms</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect to additional sports platforms to import your schedules and events
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {platforms.filter(p => !p.connected).map(platform => (
            <div 
              key={platform.id} 
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div 
                className="p-4 border-b" 
                style={{ backgroundColor: platform.color + '10' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center mr-3"
                      style={{ backgroundColor: platform.color + '20', color: platform.color }}
                    >
                      <platform.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">{platform.name}</h3>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Connect to {platform.name} to import your schedules, events, and team information.
                </p>
                
                <div className="flex justify-between items-center">
                  <a 
                    href="#" 
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                    onClick={(e) => e.preventDefault()}
                  >
                    Learn more
                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </a>
                  
                  <button
                    className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => handleConnect(platform.id)}
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {platforms.filter(p => !p.connected).length === 0 && (
            <div className="col-span-full p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">All platforms connected!</h3>
              <p className="mt-1 text-gray-500">You've connected all available platforms</p>
            </div>
          )}
        </div>
      </div>
      
      {renderConnectionDialog()}
    </div>
  );
};

export default Connections;