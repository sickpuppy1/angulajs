angular.module('carApp')
.controller('MessagesController', [
    '$scope',
    '$state',
    '$stateParams',
    '$timeout',
    'AuthService',
    'MessageService',
    'UserService',
    'CarService',
    'BookingService',
    'ToastService',
    '$q',
    function($scope, $state, $stateParams, $timeout, AuthService, MessageService, UserService, 
             CarService, BookingService, ToastService, $q) {
        var vm = this;
        
        // Initialize properties
        vm.currentUser = AuthService.getCurrentUser();
        vm.conversations = [];
        vm.messages = [];
        vm.currentConversation = null;
        vm.newMessage = '';
        vm.isLoading = true;
        vm.isLoadingMessages = false;
        vm.showImageUpload = false;
        vm.imagePreview = null;
        vm.imageFile = null;
        vm.messageDates = []; // For date grouping
        
        // Bid data
        vm.bidData = {
            showModal: false,
            startDate: null,
            endDate: null,
            amount: null,
            processing: false,
            validationError: null
        };
        
        // Initialize
        init();
        
        function init() {
            if (!vm.currentUser) {
                ToastService.error('Please login to view your messages');
                $state.go('login');
                return;
            }
            
            loadConversations()
                .then(function() {
                    if (vm.conversations.length > 0) {
                        vm.selectConversation(vm.conversations[0]);
                    }
                    $timeout();
                });
        }
        
        // Load conversations
        function loadConversations() {
            vm.isLoading = true;
            
            return MessageService.getConversations(vm.currentUser.user_id)
                .then(function(conversations) {
                    // First update the conversations array
                    vm.conversations = conversations || [];
                    
                    // Then log it (after assignment)
                    console.log('Conversations loaded:', vm.conversations);
                    
                    // If conversations are empty, create a dummy conversation for testing
                    if (vm.conversations.length === 0) {
                        console.log('No conversations found, you may need to create one');
                    }
                    
                    // Load details for each conversation
                    return $q.all((vm.conversations || []).map(function(conversation) {
                        // Find the other participant (not current user)
                        const otherUserId = conversation.participants.find(id => 
                            id !== vm.currentUser.user_id
                        );
                        
                        // Load user details and car details (if available)
                        return $q.all([
                            UserService.getUserById(otherUserId),
                            conversation.car_id ? CarService.getCarById(conversation.car_id) : $q.resolve(null)
                        ]).then(function(results) {
                            const [otherUser, carDetails] = results;
                            conversation.otherParticipant = otherUser || { name: 'Unknown User' };
                            conversation.carDetails = carDetails;
                            
                            return conversation;
                        });
                    }));
                })
                .then(function(enhancedConversations) {
                    vm.conversations = enhancedConversations || [];
                    return enhancedConversations;
                })
                .catch(function(error) {
                    console.error('Error loading conversations:', error);
                    ToastService.error('Failed to load conversations');
                    return [];
                })
                .finally(function() {
                    vm.isLoading = false;
                });
        }

        // Open conversation by ID
        function openConversationById(conversationId) {
            const conversation = vm.conversations.find(c => c.conversation_id === conversationId);
            if (conversation) {
                vm.selectConversation(conversation);
            } else {
                // Try to fetch it directly
                MessageService.getConversationById(conversationId)
                    .then(function(conversation) {
                        if (!conversation) {
                            ToastService.error('Conversation not found');
                            return;
                        }
                        
                        // Get other participant and car details
                        const otherUserId = conversation.participants.find(id => 
                            id !== vm.currentUser.user_id
                        );
                        
                        return $q.all([
                            UserService.getUserById(otherUserId),
                            conversation.car_id ? CarService.getCarById(conversation.car_id) : $q.resolve(null),
                            $q.resolve(conversation)
                        ]);
                    })
                    .then(function(results) {
                        if (!results) return;
                        
                        const [otherUser, carDetails, conversation] = results;
                        conversation.otherParticipant = otherUser || { name: 'Unknown User' };
                        conversation.carDetails = carDetails;
                        
                        vm.conversations.push(conversation);
                        vm.selectConversation(conversation);
                    })
                    .catch(function(error) {
                        console.error('Error opening conversation:', error);
                        ToastService.error('Failed to open conversation');
                    });
            }
        }
        
        // Select a conversation
        vm.selectConversation = function(conversation) {
            console.log('Selecting conversation:', conversation);
            
            // Check if conversation has proper participant info
            if (!conversation.otherParticipant || !conversation.otherParticipant.user_id) {
                // Find the other participant (not current user)
                const otherUserId = conversation.participants.find(id => id !== vm.currentUser.user_id);
                
                if (!otherUserId) {
                    console.error('Cannot find other participant in conversation', conversation);
                    ToastService.error('Invalid conversation data');
                    return;
                }
                
                // Load other user details
                UserService.getUserById(otherUserId)
                    .then(function(otherUser) {
                        if (!otherUser) {
                            console.warn('Could not find user details for ID:', otherUserId);
                            conversation.otherParticipant = { 
                                user_id: otherUserId,
                                name: 'Unknown User' 
                            };
                        } else {
                            conversation.otherParticipant = otherUser;
                        }
                        
                        // Now continue with conversation selection
                        selectConversationInternal(conversation);
                    })
                    .catch(function(error) {
                        console.error('Error loading other user details:', error);
                        conversation.otherParticipant = { 
                            user_id: otherUserId,
                            name: 'Unknown User' 
                        };
                        
                        // Still continue with conversation selection
                        selectConversationInternal(conversation);
                    });
            } else {
                // Already has participant info, proceed directly
                selectConversationInternal(conversation);
            }
        };

        // Extract the original function content to avoid duplicating code
        function selectConversationInternal(conversation) {
            // Set current conversation
            vm.currentConversation = conversation;
            vm.isLoadingMessages = true;
            
            // Get messages
            MessageService.getMessagesByConversationId(conversation.conversation_id)
                .then(function(messages) {
                    // Update messages array
                    vm.messages = messages || [];
                    console.log('Loaded messages:', vm.messages.length);
                    
                    // Group messages by date for display
                    updateMessageDates();
                    
                    // Mark unread messages as read
                    const unreadMessages = messages.filter(function(message) {
                        return !message.read && message.sender_id !== vm.currentUser.user_id;
                    });
                    
                    if (unreadMessages && unreadMessages.length > 0) {
                        console.log('Marking messages as read:', unreadMessages.length);
                        return MessageService.markAsRead(unreadMessages)
                            .then(function() {
                                // Update conversation list to refresh unread counts
                                return loadConversations();
                            });
                    }
                    
                    return $q.resolve();
                })
                .catch(function(error) {
                    console.error('Error loading messages:', error);
                    ToastService.error('Failed to load messages');
                })
                .finally(function() {
                    // Scroll to bottom of message container after loading
                    $timeout(function() {
                        scrollToBottom();
                        vm.isLoadingMessages = false;
                    });
                });
            
            // Update URL to include conversation ID without reloading
            $state.go('.', { conversationId: conversation.conversation_id }, { notify: false });
        }

        // Load messages for a conversation
        function loadMessages(conversationId) {
            if (!conversationId) {
                console.warn('No conversation ID provided to loadMessages');
                return $q.reject('No conversation ID');
            }
            
            vm.isLoadingMessages = true;
            console.log('Loading messages for conversation:', conversationId);
            
            return MessageService.getMessagesByConversationId(conversationId)
                .then(function(messages) {
                    vm.messages = messages || [];
                    console.log('Loaded messages:', vm.messages.length);
                    
                    // Group by date for display
                    updateMessageDates();
                    
                    // Mark unread messages as read
                    const unreadMessages = messages.filter(function(message) {
                        return !message.read && message.sender_id !== vm.currentUser.user_id;
                    });
                    
                    if (unreadMessages.length > 0) {
                        console.log('Marking messages as read:', unreadMessages.length);
                        return MessageService.markAsRead(unreadMessages);
                    }
                    
                    return $q.resolve();
                })
                .then(function() {
                    // Scroll to bottom of message container
                    $timeout(function() {
                        scrollToBottom();
                    });
                })
                .catch(function(error) {
                    console.error('Error loading messages:', error);
                    ToastService.error('Failed to load messages');
                })
                .finally(function() {
                    vm.isLoadingMessages = false;
                });
        }
        
        // Update message dates for grouping
        function updateMessageDates() {
            const dates = {};
            
            vm.messages.forEach(function(message) {
                const date = new Date(message.timestamp);
                const dateStr = date.toISOString().split('T')[0];
                dates[dateStr] = true;
            });
            
            vm.messageDates = Object.keys(dates).sort();
        }
        
        // Format timestamp for display
        vm.formatTime = function(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp);
            const now = new Date();
            
            // If today, show time
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            // If this year, show month and day
            if (date.getFullYear() === now.getFullYear()) {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
            
            // Otherwise show month, day, year
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        };

        // Get messages for a specific date
        vm.getMessagesByDate = function(dateStr) {
            const date = new Date(dateStr);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            return vm.messages.filter(function(message) {
                const msgDate = new Date(message.timestamp);
                return msgDate >= date && msgDate < nextDate;
            });
        };
        
        // Get other user's name
        vm.getOtherUserName = function() {
            if (!vm.currentConversation || !vm.currentConversation.otherParticipant) {
                return 'Unknown User';
            }
            return vm.currentConversation.otherParticipant.name || 'Unknown User';
        };
        
        // Send a new message
        vm.sendMessage = function() {
            // Don't send empty messages
            if (!vm.newMessage.trim() && !vm.imageFile) {
                return;
            }
            
            if (!vm.currentConversation) {
                ToastService.error('No conversation selected');
                return;
            }
            
            // If we have an image, send that
            if (vm.imageFile) {
                sendImageMessage();
                return;
            }
            
            // Create message object
            const message = {
                conversation_id: vm.currentConversation.conversation_id,
                sender_id: vm.currentUser.user_id,
                receiver_id: vm.currentConversation.otherParticipant.user_id,
                content: vm.newMessage.trim(),
                type: 'text',
                timestamp: new Date().toISOString(),
                read: false
            };
            
            // Send the message
            MessageService.sendMessage(message)
                .then(function(sentMessage) {
                    // Add to local message list
                    vm.messages.push(sentMessage);
                    console.log('Sent message:', sentMessage);
                    updateMessageDates();
                    
                    // Clear input
                    vm.newMessage = '';
                    
                    // Scroll to bottom
                    scrollToBottom();
                    
                    // Update conversation list
                    return loadConversations();
                })
                .catch(function(error) {
                    console.error('Error sending message:', error);
                    ToastService.error('Failed to send message');
                });
        };
        
        // Handle image selection
        vm.onImageSelected = function(inputElement) {
            const file = inputElement.files[0];
            if (!file) return;
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                ToastService.error('Image size must be less than 5MB');
                return;
            }
            
            // Check file type
            if (!file.type.match('image.*')) {
                ToastService.error('Only image files are supported');
                return;
            }
            
            // Store file
            vm.imageFile = file;
            
            // Create preview
            const reader = new FileReader();
            reader.onload = function(e) {
                $timeout(function() {
                    vm.imagePreview = e.target.result;
                });
            };
            reader.readAsDataURL(file);
        };
        
        // Remove selected image
        vm.removeImage = function() {
            vm.imageFile = null;
            vm.imagePreview = null;
            document.getElementById('image-upload').value = '';
        };
        
        // Send image message
        function sendImageMessage() {
            if (!vm.imageFile) return;
            
            // Create a FileReader to convert image to base64
            const reader = new FileReader();
            reader.onload = function(e) {
                // Create message with image
                const message = {
                    conversation_id: vm.currentConversation.conversation_id,
                    sender_id: vm.currentUser.user_id,
                    receiver_id: vm.currentConversation.otherParticipant.user_id,
                    content: vm.newMessage.trim(),
                    type: 'image',
                    imageUrl: e.target.result,
                    timestamp: new Date().toISOString(),
                    read: false
                };
                
                // Send the message
                MessageService.sendMessage(message)
                    .then(function(sentMessage) {
                        // Add to local message list
                        vm.messages.push(sentMessage);
                        updateMessageDates();
                        
                        // Clear inputs
                        vm.newMessage = '';
                        vm.imageFile = null;
                        vm.imagePreview = null;
                        document.getElementById('image-upload').value = '';
                        
                        // Scroll to bottom
                        scrollToBottom();
                        
                        // Update conversation list
                        return loadConversations();
                    })
                    .catch(function(error) {
                        console.error('Error sending image message:', error);
                        ToastService.error('Failed to send image');
                    });
            };
            
            reader.readAsDataURL(vm.imageFile);
        }
        
        // Scroll to bottom of message container
        function scrollToBottom() {
            $timeout(function() {
                const messageContainer = document.querySelector('.messages-list');
                if (messageContainer) {
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                }
            });
        }
    }
]);

// Update this method in MessageService.js
this.getConversations = function(userId) {
    if (!userId) {
        return $q.reject('User ID is required');
    }
    
    // Use the direct IndexedDB query with the correct index
    return DatabaseService.query('conversations', 'participants', userId)
        .then(function(conversations) {
            if (!conversations || !Array.isArray(conversations)) {
                return [];
            }
            
            // For each conversation, get the last message and unread count
            const promises = conversations.map(function(conversation) {
                return $q.all([
                    // Get last message
                    DatabaseService.query('messages', 'conversation_id', conversation.conversation_id)
                        .then(function(messages) {
                            if (!messages || messages.length === 0) {
                                return null;
                            }
                            
                            // Sort by timestamp descending to get the latest
                            messages.sort(function(a, b) {
                                return new Date(b.timestamp) - new Date(a.timestamp);
                            });
                            
                            return messages[0];
                        }),
                    // Get unread count
                    DatabaseService.query('messages', 'conversation_id', conversation.conversation_id)
                        .then(function(messages) {
                            return messages.filter(function(message) {
                                return !message.read && message.receiver_id === userId;
                            }).length;
                        })
                ]).then(function([lastMessage, unreadCount]) {
                    return {
                        ...conversation,
                        lastMessage: lastMessage || { content: 'No messages yet' },
                        unreadCount: unreadCount
                    };
                });
            });
            
            return $q.all(promises)
                .then(function(enhancedConversations) {
                    // Sort by most recent message
                    enhancedConversations.sort(function(a, b) {
                        const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date(0);
                        const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date(0);
                        return bTime - aTime;
                    });
                    
                    return enhancedConversations;
                });
        });
};

// Update this method in MessageService.js
this.getMessagesByConversationId = function(conversationId) {
    if (!conversationId) {
        return $q.reject('Conversation ID is required');
    }
    
    return DatabaseService.query('messages', 'conversation_id', conversationId)
        .then(function(messages) {
            if (!messages || !Array.isArray(messages)) {
                return [];
            }
            
            // Sort by timestamp ascending (oldest first)
            messages.sort(function(a, b) {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            return messages;
        })
        .catch(function(error) {
            console.error('Error getting messages:', error);
            return $q.reject(error);
        });
};

// Update the createConversation function in MessageService
this.createConversation = function(conversation) {
    if (!conversation || !Array.isArray(conversation.participants) || conversation.participants.length < 2) {
        return $q.reject('Invalid conversation data');
    }
    
    // Ensure participants are unique strings
    const uniqueParticipants = Array.from(new Set(conversation.participants))
        .filter(id => typeof id === 'string' && id.trim() !== '');
    
    if (uniqueParticipants.length < 2) {
        return $q.reject('Conversation must have at least 2 valid participants');
    }
    
    const newConversation = {
        conversation_id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        participants: uniqueParticipants,
        car_id: conversation.car_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    console.log('Creating conversation with data:', newConversation);
    
    return DatabaseService.add('conversations', newConversation)
        .then(function() {
            // Return the created conversation
            return newConversation;
        });
};