void;
  teamId: string;
  currentTeamName: string;
  onSave: (teamId: string, newName: string) => Promise<void>;
  platformColor: string; // To customize the modal color based on platform
}

const EditTeamNameModal: React.FC<EditTeamNameModalProps> = ({
  isOpen,
  onClose,
  teamId,
  currentTeamName,
  onSave,
  platformColor,
}) => {
  const [newTeamName, setNewTeamName] = useState(currentTeamName);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNewTeamName(currentTeamName);
  }, [currentTeamName]);

  if (!isOpen) return null;

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(teamId, newTeamName);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Handle clicks outside the modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit Team Name</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <label htmlFor="team-name-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            New Team Name
          </label>
          <input
            type="text"
            id="team-name-input"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
            autoFocus
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving || !newTeamName.trim()}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center`}
            style={{ backgroundColor: platformColor, '--tw-ring-color': platformColor }} // Apply platform color dynamically
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTeamNameModal;
" />