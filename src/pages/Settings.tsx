import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Globe, Lock, Mail, Moon, Sun, User, Phone, Calendar as CalendarIcon, Plus, Trash2, Save, Clock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import { saveSettings, supabase } from '../lib/supabase';

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
  additional_emails: [] as string[]
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [additionalEmails, setAdditionalEmails] = useState<AdditionalEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [timezones, setTimezones] = useState<string[]>([]);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    checkAuth();
    loadUserData();
    loadTimezones();
  }, []);

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
        
        setSettings(settingsData);
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

  const handlePhotoChange = (file: File) => {
    setPhotoFile(file);
    setHasUnsavedChanges(true);
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
                <ProfilePhotoUpload 
                  currentPhotoUrl={settings.profile_photo_url} 
                  onPhotoChange={handlePhotoChange} 
                />
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
    </div>
  );
};

export default Settings;