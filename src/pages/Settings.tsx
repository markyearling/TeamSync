import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Globe, Lock, Mail, Moon, Sun, User, Phone, Calendar as CalendarIcon, Plus, Trash2, Save, Clock, Eye, EyeOff, AlertCircle, CheckCircle, X, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { saveSettings, supabase } from '../lib/supabase';
import { useCapacitor } from '../hooks/useCapacitor';
import MobilePhotoUpload from '../components/mobile/MobilePhotoUpload';

interface AdditionalEmail {
  id: string;
  email: string;
}

const defaultSettings = {
  full_name: '',
  phone_number: '',
  profile_photo_url: null,
  email_notifications: true,
  sms_notifications: false,
  in_app_notifications: true,
  schedule_updates: true,
  team_communications: true,
  all_notifications: true,
  language: 'en',
  theme: 'light',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  additional_emails: [] as string[],
  notification_lead_time_minutes: 60
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isNative } = useCapacitor();
  const [additionalEmails, setAdditionalEmails] = useState<AdditionalEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [timezones, setTimezones] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadUserData();
    loadTimezones();
  }, []);

  // Update photoPreview when settings.profile_photo_url changes
  useEffect(() => {
    setPhotoPreview(settings.profile_photo_url);
  }, [settings.profile_photo_url]);

  const loadTimezones = () => {
    // Get a list of all available timezones
    const allTimezones = Intl.supportedValuesOf('timeZone');
    setTimezones(allTimezones);
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth/signin', { state: { returnTo: '/settings' } });
    }
  };

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }

      // Load existing settings
      const { data: settingsData, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
        return;
      }

      if (settingsData) {
        // If timezone is not set, use browser default
        if (!settingsData.timezone) {
          settingsData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        
        // If notification_lead_time_minutes is not set, use default
        if (!settingsData.notification_lead_time_minutes) {
          settingsData.notification_lead_time_minutes = 60;
        }
        
        // If schedule_updates is not set, use default
        if (settingsData.schedule_updates === null || settingsData.schedule_updates === undefined) {
          settingsData.schedule_updates = true;
        }
        
        setSettings(settingsData);
        setPhotoPreview(settingsData.profile_photo_url);
        
        if (settingsData.additional_emails) {
          setAdditionalEmails(
            settingsData.additional_emails.map((email: string) => ({
              id: Math.random().toString(),
              email
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const addEmail = () => {
    if (newEmail && newEmail.includes('@')) {
      setAdditionalEmails([...additionalEmails, { id: Date.now().toString(), email: newEmail }]);
      setNewEmail('');
      setHasUnsavedChanges(true);
    }
  };

  const removeEmail = (id: string) => {
    setAdditionalEmails(additionalEmails.filter(email => email.id !== id));
    setHasUnsavedChanges(true);
  };

  const handlePhotoChange = (fileOrDataUrl: File | string) => {
    if (typeof fileOrDataUrl === 'string') {
      // Handle data URL (from mobile camera)
      setPhotoPreview(fileOrDataUrl);
      
      // Convert data URL to File object
      fetch(fileOrDataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
          setPhotoFile(file);
          setHasUnsavedChanges(true);
        });
    } else {
      // Handle File object (from web file input)
      setPhotoFile(fileOrDataUrl);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(fileOrDataUrl);
      
      setHasUnsavedChanges(true);
    }
  };

  const handleWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoChange(file);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth/signin', { state: { returnTo: '/settings' } });
        return;
      }

      await saveSettings({
        ...settings,
        photo_file: photoFile,
        additional_emails: additionalEmails.map(email => email.email)
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Here you would typically show an error message to the user
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Reset states
    setPasswordError(null);
    setPasswordSuccess(null);
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      // Success
      setPasswordSuccess('Password updated successfully! You will be signed out for security reasons.');
      setNewPassword('');
      setConfirmPassword('');
      
      // Sign out after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth/signin', { 
          state: { 
            message: 'Your password has been updated. Please sign in with your new password.' 
          } 
        });
      }, 3000);
      
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    
    try {
      // Get the current session to obtain the access token for function invocation
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('No active session. Please sign in first.');

      console.log('Calling delete-user-account Edge Function...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      const result = await response.json();
      console.log('Account deletion successful:', result.message);

      // Sign out after successful deletion
      await supabase.auth.signOut();
      navigate('/auth/signin', { 
        state: { 
          message: 'Your account has been successfully deleted.' 
        } 
      });

    } catch (err) {
      console.error('Failed to delete account:', err);
      setDeleteError(err instanceof Error ? err.message : 'An unknown error occurred during account deletion.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        {hasUnsavedChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                {isNative ? (
                  <MobilePhotoUpload
                    currentPhotoUrl={photoPreview}
                    onPhotoChange={handlePhotoChange}
                  />
                ) : (
                  <div className="relative">
                    <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                          <User className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <Plus className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      <input
                        ref={fileInputRef}
                        id="photo-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleWebFileChange}
                      />
                    </label>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                      Click to upload photo
                    </p>
                  </div>
                )}
                <div className="flex-1">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                      <input
                        type="text"
                        value={settings.full_name || ''}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <input
                        type="email"
                        value={userEmail}
                        disabled
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                      />
                      <p className="mt-1 text-sm text-gray-500">This is your primary email address used for authentication.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                      <input
                        type="tel"
                        value={settings.phone_number || ''}
                        onChange={(e) => handleInputChange('phone_number', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Email Addresses</h3>
                <div className="space-y-2">
                  {additionalEmails.map(email => (
                    <div key={email.id} className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={email.email}
                        readOnly
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <button
                        onClick={() => removeEmail(email.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Add another email"
                      className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={addEmail}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone Settings</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-gray-400 mr-3" />
                    <div className="flex-1">
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Your Timezone
                      </label>
                      <select
                        id="timezone"
                        value={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                        onChange={(e) => handleInputChange('timezone', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        {timezones.map(tz => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        This timezone will be used for displaying events and syncing calendars
                      </p>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Current time in your timezone: <strong>{new Date().toLocaleString(undefined, { timeZone: settings.timezone })}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Notification Preferences Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notification Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Bell className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Event Notifications</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get notified before your events start</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.schedule_updates}
                        onChange={(e) => handleInputChange('schedule_updates', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {settings.schedule_updates && (
                    <div className="ml-8">
                      <label htmlFor="notification-lead-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notification Timing
                      </label>
                      <select
                        id="notification-lead-time"
                        value={settings.notification_lead_time_minutes || 60}
                        onChange={(e) => handleInputChange('notification_lead_time_minutes', parseInt(e.target.value))}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                        <option value={120}>2 hours before</option>
                        <option value={360}>6 hours before</option>
                        <option value={720}>12 hours before</option>
                        <option value={1440}>1 day before</option>
                      </select>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Choose how far in advance you want to be notified about upcoming events
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Change Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Lock className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Update your password</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  >
                    {showPasswordSection ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showPasswordSection && (
                  <div className="mt-4 space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    {passwordSuccess && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300 mt-0.5 mr-3" />
                        <p className="text-sm text-green-700 dark:text-green-300">{passwordSuccess}</p>
                      </div>
                    )}

                    {passwordError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300 mt-0.5 mr-3" />
                        <p className="text-sm text-red-700 dark:text-red-300">{passwordError}</p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        New Password
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Password must be at least 8 characters with uppercase, lowercase, and number
                      </p>
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Confirm New Password
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !newPassword || !confirmPassword}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {isChangingPassword ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          'Update Password'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Globe className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Language</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred language</p>
                  </div>
                </div>
                <select 
                  value={settings.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                  className="text-sm text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Sun className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Choose light or dark theme</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-md ${
                      theme === 'light'
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                  </button>
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-md ${
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Danger Zone</h2>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Delete Account</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirmation(true)}
                className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center whitespace-nowrap text-sm"
              >
                <Trash2 className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <LogOut className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign Out</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sign out of your account</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth/signin');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Confirm Account Deletion</h3>
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                disabled={isDeletingAccount}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {deleteError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-start mb-4">
                  <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300 mt-0.5 mr-3" />
                  <p className="text-sm text-red-700 dark:text-red-300">{deleteError}</p>
                </div>
              )}
              
              <div className="flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                <AlertCircle className="h-12 w-12" />
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4 text-center">
                Are you absolutely sure you want to delete your account?
              </p>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will permanently delete your account and all associated data, including:
              </p>
              
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1">
                <li>Your user profile and settings</li>
                <li>All children profiles you own, their events, and team mappings</li>
                <li>All platform connections</li>
                <li>Your notifications and scheduled reminders</li>
                <li>Your conversations and messages</li>
                <li>Your friend requests and friendships</li>
              </ul>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium text-center">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;