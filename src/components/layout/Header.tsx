const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const friendsDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  const navigate = useNavigate();