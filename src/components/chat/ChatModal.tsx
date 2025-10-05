import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User, Smile } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCapacitor } from '../../hooks/useCapacitor';
import { Keyboard } from '@capacitor/keyboard';

interface Friend {
  id: string;
  friend_id: string;
  role: 'none' | 'viewer' | 'administrator';
  friend: {
    id: string;
    full_name?: string;
    profile_photo_url?: string;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: {
    full_name?: string;
    profile_photo_url?: string;
  };
}

interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string;
}

interface ChatModalProps {
  friend: Friend;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ friend, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<any>(null);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emoticonRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const sendersCache = useRef<Map<string, any>>(new Map());
  const isInitialMount = useRef(true);
  const initializationInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const { isNative } = useCapacitor();

  // Helper function to fetch sender info (with caching)
  const getSenderInfo = async (senderId: string) => {
    if (sendersCache.current.has(senderId)) {
      return sendersCache.current.get(senderId);
    }

    const { data: senderSettings } = await supabase
      .from('user_settings')
      .select('full_name, profile_photo_url')
      .eq('user_id', senderId)
      .maybeSingle();

    sendersCache.current.set(senderId, senderSettings);
    return senderSettings;
  };

  // Load only the most recent messages initially for faster loading
  const INITIAL_MESSAGE_LOAD_LIMIT = 50;

  // Popular emoticons organized by category
  const emoticons = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
    'Emotions': ['😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
    'Reactions': ['😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓'],
    'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],
    'Objects': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '⛳']
  };

  // Auto-scroll to bottom function
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Force scroll to bottom (for initial load and new messages)
  const forceScrollToBottom = () => {
    setTimeout(() => {
      scrollToBottom('auto');
    }, 50);
  };

  // Determine if we should use full-screen modal on mobile
  const containerClasses = isNative
    ? "fixed inset-0 z-50 bg-white dark:bg-gray-800"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6";

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full overflow-hidden"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-full max-h-full overflow-hidden flex flex-col";

  useEffect(() => {
    // Reset initialization guards when modal reopens or friend changes
    hasInitialized.current = false;
    initializationInProgress.current = false;

    initializeChat();

    // Focus input when modal opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    // Set up keyboard listeners for native apps
    let keyboardWillShowListener: any = null;
    let keyboardWillHideListener: any = null;

    if (isNative) {
      console.log('Setting up keyboard listeners for native app');
      
      keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (info) => {
        console.log('Keyboard will show with height:', info.keyboardHeight);
        setKeyboardHeight(info.keyboardHeight);
        
        // Scroll to bottom when keyboard appears to keep input visible
        setTimeout(() => forceScrollToBottom(), 100);
      });

      keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
        console.log('Keyboard will hide');
        setKeyboardHeight(0);
      });
    }
    // Close emoticon picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (emoticonRef.current && !emoticonRef.current.contains(event.target as Node)) {
        setShowEmoticons(false);
      }
      
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      
      // Clean up keyboard listeners
      if (keyboardWillShowListener) {
        keyboardWillShowListener.remove();
      }
      if (keyboardWillHideListener) {
        keyboardWillHideListener.remove();
      }
      
      // Clean up subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [friend.friend_id, onClose]);

  // Scroll to bottom only on initial load, not on every message change
  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialMount.current) {
      isInitialMount.current = false;
      forceScrollToBottom();
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (!conversation || !currentUserId) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      console.log('🔄 Cleaning up previous subscription');
      subscriptionRef.current.unsubscribe();
    }

    console.log('🔧 Setting up real-time subscription for conversation:', conversation.id);

    // Set up real-time subscription for messages in this conversation
    subscriptionRef.current = supabase
      .channel(`messages:conversation_id=eq.${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          console.log('📨 New message received via realtime:', payload.new.id);
          const newMessage = payload.new as Message;

          // Get sender info using cached helper
          const senderSettings = await getSenderInfo(newMessage.sender_id);

          const messageWithSender = {
            ...newMessage,
            created_at: newMessage.created_at,
            sender: senderSettings
          };

          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('⚠️ Realtime: Message already exists, skipping duplicate');
              return prev;
            }

            console.log('➕ Realtime: Adding new message to state');
            return [...prev, messageWithSender];
          });

          // Scroll after state update, outside of setState
          setTimeout(() => forceScrollToBottom(), 50);

          // Mark message as read if it's not from current user and modal is open
          if (newMessage.sender_id !== currentUserId) {
            await markMessageAsRead(newMessage.id);
            // Update last read timestamp since user is actively viewing messages
            await updateLastReadTimestamp(conversation.id, currentUserId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          console.log('Message updated via realtime:', payload);
          const updatedMessage = payload.new as Message;

          // Get sender info using cached helper
          const senderSettings = await getSenderInfo(updatedMessage.sender_id);

          const messageWithSender = {
            ...updatedMessage,
            sender: senderSettings
          };

          setMessages(prev =>
            prev.map(msg =>
              msg.id === updatedMessage.id ? messageWithSender : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat subscription status:', status, 'for conversation:', conversation.id);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to real-time messages');
        } else if (status === 'CLOSED') {
          console.warn('🔌 Subscription closed');
        }
      });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [conversation, currentUserId]);

  const initializeChat = async () => {
    // Prevent double initialization
    if (initializationInProgress.current || hasInitialized.current) {
      console.log('⏭️ Skipping initialization (already initialized or in progress)');
      return;
    }

    initializationInProgress.current = true;

    try {
      console.log('🔄 Initializing chat for friend:', friend.friend_id);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      console.log('🔄 Current user ID:', user.id);
      setCurrentUserId(user.id);

      // Get current user info
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('full_name, profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      setCurrentUserInfo(userSettings);

      // Find or create conversation
      console.log('🔄 Finding or creating conversation');
      let conversationData = await findOrCreateConversation(user.id, friend.friend_id);
      console.log('🔄 Conversation found/created:', conversationData.id);
      setConversation(conversationData);

      // Load messages
      console.log('🔄 Loading messages');
      await loadMessages(conversationData.id);

      // Mark all messages from friend as read
      console.log('🔄 Marking conversation as read');
      await markConversationAsRead(conversationData.id, user.id);

      console.log('✅ Chat initialization complete');
      hasInitialized.current = true;
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
    } finally {
      setLoading(false);
      initializationInProgress.current = false;
    }
  };

  const findOrCreateConversation = async (userId: string, friendId: string): Promise<Conversation> => {
    // Always put participant IDs in canonical order (smaller UUID first)
    const participant1 = userId < friendId ? userId : friendId;
    const participant2 = userId < friendId ? friendId : userId;

    // Try to find existing conversation using canonical ordering
    const { data: existingConversation, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .eq('participant_1_id', participant1)
      .eq('participant_2_id', participant2)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existingConversation) {
      return existingConversation;
    }

    // Try to create new conversation
    try {
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          participant_1_id: participant1,
          participant_2_id: participant2
        })
        .select()
        .single();

      if (createError) throw createError;

      return newConversation;
    } catch (createError: any) {
      // Handle race condition: if conversation was created by another process
      if (createError.code === '23505') {
        // Duplicate key constraint violation - conversation was created concurrently
        // Try to fetch it again
        const { data: existingConversation, error: refetchError } = await supabase
          .from('conversations')
          .select('*')
          .eq('participant_1_id', participant1)
          .eq('participant_2_id', participant2)
          .single();

        if (refetchError) throw refetchError;
        if (!existingConversation) throw new Error('Conversation not found after concurrent creation');

        return existingConversation;
      }
      
      // Re-throw other errors
      throw createError;
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      console.log('📥 Loading messages for conversation:', conversationId);

      // Load MOST RECENT messages in reverse order (newest first), then reverse the array
      // This ensures we always see the latest messages even if there are more than LIMIT
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })  // Get newest first
        .limit(INITIAL_MESSAGE_LOAD_LIMIT);

      if (error) throw error;

      console.log('📥 Loaded messages count:', messagesData?.length || 0);

      if (!messagesData || messagesData.length === 0) {
        console.log('📥 No messages found, setting empty array');
        setMessages([]);
        return;
      }

      console.log('📥 Newest message:', messagesData[0]?.created_at);
      console.log('📥 Oldest message loaded:', messagesData[messagesData.length - 1]?.created_at);

      // Reverse the array so messages are in chronological order (oldest to newest)
      const messagesInChronologicalOrder = messagesData.reverse();

      // Get unique sender IDs
      const senderIds = [...new Set(messagesInChronologicalOrder.map(m => m.sender_id))];

      // Batch fetch sender info for all unique senders
      const { data: sendersData } = await supabase
        .from('user_settings')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', senderIds);

      // Create a map for quick lookup
      const sendersMap = new Map(
        sendersData?.map(s => [s.user_id, s]) || []
      );

      // Attach sender info to messages
      const messagesWithSenders = messagesInChronologicalOrder.map(message => ({
        ...message,
        sender: sendersMap.get(message.sender_id)
      }));

      console.log('📥 Setting messages state with', messagesWithSenders.length, 'messages');
      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || !currentUserId || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();

    // Clear input immediately for better UX
    setNewMessage('');
    setShowEmoticons(false);

    try {
      // Insert the message immediately without waiting for notification logic
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: currentUserId,
          content: messageContent
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Message sent successfully:', insertedMessage.id);

      // Add message optimistically for immediate feedback
      const messageWithSender = {
        ...insertedMessage,
        sender: currentUserInfo
      };

      setMessages(prev => {
        // Check if message already exists (from real-time subscription)
        const exists = prev.some(msg => msg.id === insertedMessage.id);
        if (exists) {
          console.log('⚠️ Message already exists (from realtime), skipping optimistic add');
          return prev;
        }
        console.log('➕ Adding message optimistically');
        return [...prev, messageWithSender];
      });

      // Scroll after state update, outside of setState
      setTimeout(() => forceScrollToBottom(), 50);

      // Note: Notifications are handled automatically by the database trigger
      // No need to manually invoke the notification edge function

    } catch (error) {
      console.error('Error sending message:', error);
      // Restore input on error
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const addEmoticon = (emoticon: string) => {
    setNewMessage(prev => prev + emoticon);
    setShowEmoticons(false);
    inputRef.current?.focus();
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markConversationAsRead = async (conversationId: string, userId: string) => {
    try {
      // Mark all messages from the other person as read
      const { error: countError } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('read', false);

      if (countError) {
        console.error('Error marking conversation as read:', countError);
      }

      // Use the database function to ensure all messages are marked as read
      const { error: funcError } = await supabase.rpc(
        'mark_conversation_messages_read',
        {
          conversation_id_param: conversationId,
          user_id_param: userId
        }
      );

      if (funcError) {
        console.error('Error calling mark_conversation_messages_read function:', funcError);
      }

      // Update the conversation's last_read_at timestamp for this user
      await updateLastReadTimestamp(conversationId, userId);
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  const updateLastReadTimestamp = async (conversationId: string, userId: string) => {
    try {
      if (!conversation) return;

      // Determine which participant field to update
      const isParticipant1 = conversation.participant_1_id === userId;
      const fieldToUpdate = isParticipant1 ? 'participant_1_last_read_at' : 'participant_2_last_read_at';

      const { error } = await supabase
        .from('conversations')
        .update({ [fieldToUpdate]: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        console.error('Error updating last read timestamp:', error);
      } else {
        console.log('Updated last read timestamp for user');
      }
    } catch (error) {
      console.error('Error updating last read timestamp:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
  };

  return (
    <div
      className={containerClasses}
      style={isNative ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      } : {}}
    >
      <div
        ref={modalRef}
        className={modalContentClasses}
        onClick={(e) => e.stopPropagation()}
        style={isNative && keyboardHeight > 0 ? {
          height: `calc(100% - ${keyboardHeight}px)`
        } : {}}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center">
                {friend.friend.profile_photo_url ? (
                  <img 
                    src={friend.friend.profile_photo_url} 
                    alt="" 
                    className="w-10 h-10 rounded-full object-cover" 
                  />
                ) : (
                  <User className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {friend.friend.full_name || 'Friend'}
                </h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Chat
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ scrollBehavior: 'auto' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length > 0 ? (
            messages.map((message, index) => {
              const isCurrentUser = message.sender_id === currentUserId;
              const showAvatar = !isCurrentUser && (
                index === 0 || 
                messages[index - 1].sender_id !== message.sender_id ||
                new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 5 * 60 * 1000
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                    showAvatar ? 'mt-4' : 'mt-1'
                  }`}
                >
                  {!isCurrentUser && showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-2 flex-shrink-0">
                      {message.sender?.profile_photo_url ? (
                        <img 
                          src={message.sender.profile_photo_url} 
                          alt="" 
                          className="w-8 h-8 rounded-full object-cover" 
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {(message.sender?.full_name || 'F').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  {!isCurrentUser && !showAvatar && (
                    <div className="w-8 mr-2 flex-shrink-0"></div>
                  )}
                  
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isCurrentUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    <div className={`mt-1 text-xs text-gray-500 dark:text-gray-400 ${
                      isCurrentUser ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Send a message to {friend.friend.full_name || 'your friend'}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Emoticon Picker */}
        {showEmoticons && (
          <div 
            ref={emoticonRef}
            className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto flex-shrink-0"
          >
            <div className="p-4">
              {Object.entries(emoticons).map(([category, emojis]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-10 gap-2">
                    {emojis.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => addEmoticon(emoji)}
                        className="text-xl hover:bg-gray-200 dark:hover:bg-gray-600 rounded p-1 transition-colors"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEmoticons(!showEmoticons)}
              className={`p-2 rounded-full transition-colors ${
                showEmoticons 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Add emoticon"
            >
              <Smile className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                console.log('Chat input focused - keyboard should appear');
                // Scroll to bottom when input is focused to ensure visibility
                setTimeout(() => forceScrollToBottom(), 100);
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;