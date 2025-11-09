import React, { useRef } from 'react';
import { X, Calendar as CalendarIcon, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfiles } from '../../context/ProfilesContext';
import { useCapacitor } from '../../hooks/useCapacitor';
import ModalPortal from '../ModalPortal';

interface ProfileSelectionModalProps {
  onClose: () => void;
  onProfileSelected: (profileId: string) => void;
}

const ProfileSelectionModal: React.FC<ProfileSelectionModalProps> = ({ onClose, onProfileSelected }) => {
  const { profiles } = useProfiles();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const { isNative } = useCapacitor();

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modalRef.current && !modalRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleProfileClick = (profileId: string) => {
    onProfileSelected(profileId);
  };

  const handleCreateProfile = () => {
    onClose();
    navigate('/profiles');
  };

  const modalContainerClasses = isNative
    ? "fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-800 overflow-hidden"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]";

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full md:h-auto md:max-h-[90vh] flex flex-col";

  return (
    <ModalPortal>
      <div
        className={modalContainerClasses}
        style={isNative ? {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        } : undefined}
      >
        <div
          ref={modalRef}
          className={modalContentClasses}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Select Profile</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {profiles.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Which child profile would you like to add an event for?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profiles.map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileClick(profile.id)}
                      className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group"
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold shadow-sm overflow-hidden"
                          style={{ backgroundColor: profile.color }}
                        >
                          {profile.photo_url ? (
                            <img
                              src={profile.photo_url}
                              alt={profile.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{profile.name.charAt(0)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 ml-4 text-left">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {profile.name}
                        </h4>
                        {profile.sports.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {profile.sports.slice(0, 2).map((sport, index) => (
                              <span
                                key={index}
                                className="text-xs px-2 py-0.5 rounded-md font-medium"
                                style={{
                                  backgroundColor: sport.color + '15',
                                  color: sport.color
                                }}
                              >
                                {sport.name}
                              </span>
                            ))}
                            {profile.sports.length > 2 && (
                              <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                +{profile.sports.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Profiles Yet
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  To add an event, you first need to create a child profile. Profiles help organize activities by child.
                </p>
                <button
                  onClick={handleCreateProfile}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 font-medium transition-colors shadow-sm"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create Your First Profile
                </button>
              </div>
            )}
          </div>

          {profiles.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <button
                onClick={handleCreateProfile}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Create New Profile
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProfileSelectionModal;
