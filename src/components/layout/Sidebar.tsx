import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  Link as LinkIcon, 
  Users, 
  Settings, 
  X,
  UserPlus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useProfiles } from '../../context/ProfilesContext';

interface SidebarProps {
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { profiles, friendsProfiles } = useProfiles();
  const navigate = useNavigate();
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  
  const navigation = [
    { name: 'Dashboard', icon: Home, href: '/' },
    { name: 'Calendar', icon: Calendar, href: '/calendar' },
    { 
      name: 'Connections', 
      icon: LinkIcon, 
      href: '/connections',
      hasSubItems: true,
      subItems: [
        { name: 'TeamSnap', href: '/connections/teamsnap' },
        { name: 'SportsEngine', href: '/connections/sportsengine' },
        { name: 'Playmetrics', href: '/connections/playmetrics' },
        { name: 'GameChanger', href: '/connections/gamechanger' }
      ]
    },
    { name: 'Profiles', icon: Users, href: '/profiles' },
    { name: 'Friends', icon: UserPlus, href: '/friends' },
    { name: 'Settings', icon: Settings, href: '/settings' },
  ];

  const handleChildClick = (childId: string) => {
    navigate(`/profiles/${childId}`);
    onClose();
  };

  const toggleConnections = () => {
    setConnectionsOpen(!connectionsOpen);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">FamSink</span>
        </div>
        <button 
          type="button" 
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 lg:hidden"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      
      <div className="mt-5 px-2 space-y-1">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.hasSubItems ? (
              <div>
                <div className="flex items-center">
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      `group flex items-center px-2 py-2 text-base font-medium rounded-md flex-grow ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`
                    }
                    end={true}
                    onClick={onClose}
                  >
                    <item.icon 
                      className={({ isActive }: { isActive: boolean }) =>
                        `mr-4 h-6 w-6 flex-shrink-0 ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                        }`
                      }
                    />
                    {item.name}
                  </NavLink>
                  <button
                    onClick={toggleConnections}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 rounded-md"
                  >
                    {connectionsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {connectionsOpen && item.subItems && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems.map((subItem) => (
                      <NavLink
                        key={subItem.name}
                        to={subItem.href}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-sm font-medium rounded-md ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                          }`
                        }
                        onClick={onClose}
                      >
                        {subItem.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`
                }
                end={item.href === '/'}
                onClick={onClose}
              >
                <item.icon 
                  className={({ isActive }: { isActive: boolean }) =>
                    `mr-4 h-6 w-6 flex-shrink-0 ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                    }`
                  }
                />
                {item.name}
              </NavLink>
            )}
          </div>
        ))}
      </div>
      
      {/* Own Children */}
      {profiles.length > 0 && (
        <div className="mt-8">
          <h3 className="px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Your Children</h3>
          <div className="mt-1 space-y-1 px-3">
            {profiles.map((child) => (
              <button 
                key={child.id} 
                onClick={() => handleChildClick(child.id)}
                className="w-full group flex items-center rounded-md px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <div 
                  className="mr-3 h-6 w-6 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: child.color }}
                >
                  {child.photo_url ? (
                    <img 
                      src={child.photo_url} 
                      alt={child.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    child.name.charAt(0)
                  )}
                </div>
                {child.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Friends' Children (Administrator Access) */}
      {friendsProfiles.length > 0 && (
        <div className="mt-8">
          <h3 className="px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Friends' Children</h3>
          <div className="mt-1 space-y-1 px-3">
            {friendsProfiles.map((child) => (
              <button 
                key={child.id} 
                onClick={() => handleChildClick(child.id)}
                className="w-full group flex items-center rounded-md px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <div 
                  className="mr-3 h-6 w-6 rounded-full flex items-center justify-center text-white relative"
                  style={{ backgroundColor: child.color }}
                >
                  {child.photo_url ? (
                    <img 
                      src={child.photo_url} 
                      alt={child.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    child.name.charAt(0)
                  )}
                  {/* Administrator badge */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">👑</span>
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm">{child.name}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    {child.ownerName}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;