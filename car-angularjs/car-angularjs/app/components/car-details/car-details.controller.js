/**
 * @description Car Details Controller
 * Manages the car details view and booking functionality
 */
angular.module('carApp')
.controller('CarDetailsController', [
    '$stateParams',
    'CarService',
    'BookingService',
    'AuthService',
    'ToastService',
    '$state',
    '$timeout',
    'MessageService',
    'StyleLoaderService',
    function($stateParams, CarService, BookingService, AuthService, ToastService, $state, $timeout, MessageService, StyleLoaderService) {
        const vm = this;

        // Initialize state
        vm.car = null;
        vm.owner = null;
        vm.isLoading = true;
        vm.bid = {
            startDate: null,
            endDate: null,
            amount: 0
        };
        vm.bookedDates = [];
        vm.totalDays = 0;
        vm.totalPrice = 0;
        vm.conversationId = null;

        /**
         * @description Initialize controller
         * Loads component CSS and car data
         */
        vm.init = function() {
            // Load component CSS
            StyleLoaderService.loadStylesheet('app/components/car-details/car-details.css')
                .catch(error => {
                    console.error('Failed to load car details styles:', error);
                });

            if (!$stateParams.id) {
                ToastService.error('Invalid car ID');
                $state.go('home');
                return;
            }

            loadCarDetails($stateParams.id);
        };

        /**
         * @description Load car details and booked dates
         * @param {string} carId - The ID of the car to load
         */
        function loadCarDetails(carId) {
            CarService.getCarById(carId)
                .then(car => {
                    if (!car) {
                        ToastService.error('Car details not found');
                        $state.go('home');
                        return Promise.reject('Car not found');
                    }

                    vm.car = car;
                    vm.bid.amount = car.price_per_day;
                    
                    // Parse owner data if it's stored as a string
                    if (car.owner && typeof car.owner === 'string') {
                        try {
                            vm.owner = JSON.parse(car.owner);
                        } catch (e) {
                            console.error('Failed to parse owner data:', e);
                            vm.owner = null;
                        }
                    } else {
                        vm.owner = car.owner || null;
                    }

                    // Validate owner data
                    if (!vm.hasValidOwner()) {
                        console.error('Invalid owner data:', vm.owner);
                        ToastService.error('Error loading owner details');
                        return Promise.reject('Invalid owner data');
                    }

                    return BookingService.getBookedDates(car.car_id);
                })
                .then(bookedDates => {
                    vm.bookedDates = bookedDates || [];
                    initializeDatepickers();
                })
                .catch(error => {
                    console.error('Error loading car details:', error);
                    ToastService.error('Failed to load car details: ' + (error.message || error));
                })
                .finally(() => {
                    vm.isLoading = false;
                });
        }

        /**
         * @description Check if owner data is valid
         * @returns {boolean} True if owner data is valid
         */
        vm.hasValidOwner = function() {
            return vm.owner && vm.owner.user_id;
        };

        /**
         * @description Place a bid on the car
         * Creates booking and initiates conversation
         */
        vm.placeBid = function() {
            if (!vm.hasValidOwner()) {
                ToastService.error('Cannot place bid: Owner information is missing');
                return;
            }

            if (!AuthService.isAuthenticated()) {
                ToastService.error('Please login to place a bid');
                $state.go('login');
                return;
            }

            // Get user session
            const userSession = JSON.parse(sessionStorage.getItem('userSession'));
            if (!userSession || !userSession.user_id) {
                ToastService.error('Session expired, please login again');
                $state.go('login');
                return;
            }

            if (!vm.bid.startDate || !vm.bid.endDate) {
                ToastService.error('Please select both start and end dates');
                return;
            }

            // Check for date collisions
            if (checkDateCollision(vm.bid.startDate, vm.bid.endDate, vm.bookedDates)) {
                ToastService.error('Car is already booked for selected dates');
                return;
            }

            if (vm.bid.amount < vm.car.price_per_day) {
                ToastService.error('Bid amount cannot be less than minimum price');
                return;
            }

            // Generate a unique ID for the booking
            const bookingId = 'booking_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

            // Create booking object
            const booking = createBookingObject(bookingId, userSession);

            // Process booking and create conversation
            BookingService.createBooking(booking)
                .then(() => {
                    // Check if conversation already exists between owner and this user for this car
                    return MessageService.findOrCreateConversation({
                        participants: [userSession.user_id, vm.owner.user_id],
                        car_id: vm.car.car_id
                    });
                })
                .then(conversation => {
                    // Store the conversation ID for the redirect
                    vm.conversationId = conversation.conversation_id;
                    
                    // Create bid message in the conversation
                    const bidMessage = createBidMessage(conversation.conversation_id, userSession, booking);
                    return MessageService.sendMessage(bidMessage);
                })
                .then(() => {
                    ToastService.success('Bid placed successfully');
                    
                    // Redirect after a short delay to allow the toast to be visible
                    $timeout(() => {
                        $state.go('messages', { conversationId: vm.conversationId });
                    });
                })
                .catch(error => {
                    console.error('Error placing bid:', error);
                    ToastService.error('Failed to place bid: ' + (error.message || error));
                });
        };

        /**
         * @description Create booking object
         * @param {string} bookingId - Generated booking ID
         * @param {Object} userSession - Current user session
         * @returns {Object} Booking object
         */
        function createBookingObject(bookingId, userSession) {
            return {
                booking_id: bookingId,
                car_id: vm.car.car_id,
                start_date: vm.bid.startDate,
                end_date: vm.bid.endDate,
                bid_amount: vm.bid.amount,
                total_amount: vm.totalPrice,
                status: 'pending',
                created_at: new Date().toISOString(),
                car_details: {
                    make: vm.car.make,
                    model: vm.car.model,
                    year: vm.car.year,
                    price_per_day: vm.car.price_per_day,
                    color: vm.car.color,
                    location: vm.car.location,
                    images: vm.car.images || []
                },
                metadata: {
                    created_by: userSession.user_id,
                    created_at: new Date().toISOString(),
                },
                owner:{
                    user_id: vm.owner.user_id,
                    name: vm.owner.name,
                    email: vm.owner.email,
                },
                user:{
                    user_id: userSession.user_id,
                    name: userSession.name,
                    email: userSession.email,
                    
                }
            };
        }

        /**
         * @description Create bid message
         * @param {string} conversationId - Conversation ID
         * @param {Object} userSession - Current user session
         * @param {Object} booking - Booking object
         * @returns {Object} Bid message object
         */
        function createBidMessage(conversationId, userSession, booking) {
            return {
                conversation_id: conversationId,
                sender_id: userSession.user_id,
                receiver_id: vm.owner.user_id,
                content: 'New bid placed',
                type: 'bid',
                bidData: {
                    booking_id: booking.booking_id,
                    startDate: vm.bid.startDate,
                    endDate: vm.bid.endDate,
                    amount: vm.bid.amount,
                    total: vm.totalPrice,
                    status: "pending"
                },
                timestamp: new Date().toISOString(),
                read: false
            };
        }

        /**
         * @description Initialize jQuery datepickers
         */
        function initializeDatepickers() {
            $timeout(() => {
                $('#start-date').datepicker({
                    minDate: new Date(),
                    dateFormat: 'yy-mm-dd',
                    beforeShowDay: date => {
                        const dateString = $.datepicker.formatDate('yy-mm-dd', date);
                        return [!vm.bookedDates.includes(dateString), ''];
                    },
                    onSelect: selectedDate => {
                        $timeout(() => {
                            $('#end-date').datepicker('option', 'minDate', selectedDate);
                            vm.bid.startDate = selectedDate;
                            updateTotalPrice();
                        });
                    }
                });
        
                $('#end-date').datepicker({
                    minDate: new Date(),
                    dateFormat: 'yy-mm-dd',
                    beforeShowDay: date => {
                        const dateString = $.datepicker.formatDate('yy-mm-dd', date);
                        return [!vm.bookedDates.includes(dateString), ''];
                    },
                    onSelect: selectedDate => {
                        $timeout(() => {
                            vm.bid.endDate = selectedDate;
                            updateTotalPrice();
                        });
                    }
                });
            });
        }
        
        /**
         * @description Update total price based on dates and amount
         */
        function updateTotalPrice() {
            const startDate = $('#start-date').datepicker('getDate');
            const endDate = $('#end-date').datepicker('getDate');
            
            if (startDate && endDate) {
                vm.totalDays = Math.ceil(((endDate - startDate) + 1) / (1000 * 60 * 60 * 24));
                vm.totalPrice = vm.totalDays * vm.bid.amount;
            }
        }
        
        /**
         * @description Check for date collisions with booked dates
         * @param {string} startDate - Start date string
         * @param {string} endDate - End date string
         * @param {Array} bookedDates - Array of booked date strings
         * @returns {boolean} True if collision found
         */
        function checkDateCollision(startDate, endDate, bookedDates) {
            if (!bookedDates || bookedDates.length === 0) return false;
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            for (const dateStr of bookedDates) {
                const bookedDate = new Date(dateStr);
                if (bookedDate >= start && bookedDate <= end) {
                    return true; // Collision found
                }
            }
            return false;
        }

        // Watch for bid amount changes
        $timeout(() => {
            return vm.bid.amount;
        }, (newValue, oldValue) => {
            if (newValue !== oldValue && vm.totalDays > 0) {
                vm.totalPrice = vm.totalDays * newValue;
            }
        });
    }
]);