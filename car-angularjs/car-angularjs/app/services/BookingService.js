angular.module('carApp')
.service('BookingService', [
    '$q', 
    'DatabaseService', 
    function($q, DatabaseService) {
    this.getBookedDates = function(carId) {
        if (!carId) {
            return $q.reject('Invalid car ID');
        }

        return DatabaseService.query('bookings', 'car_id', carId)
            .then(function(bookings) {
                var bookedDates = [];
                
                if (!bookings || !Array.isArray(bookings)) {
                    console.warn('No bookings found or invalid bookings data');
                    return bookedDates;
                }

                bookings.forEach(function(booking) {
                    if (booking && booking.status === 'approved' && booking.start_date && booking.end_date) {
                        try {
                            var start = new Date(booking.start_date);
                            var end = new Date(booking.end_date);
                            
                            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                                console.warn('Invalid date format for booking:', booking);
                                return;
                            }

                            for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                bookedDates.push($.datepicker.formatDate('yy-mm-dd', d));
                            }
                        } catch (error) {
                            console.error('Error processing booking dates:', error);
                        }
                    }
                });
                
                return bookedDates;
            })
            .catch(function(error) {
                console.error('Error fetching booked dates:', error);
                return $q.reject(error);
            });
    };

    this.createBooking = function(booking) {
        if (!booking) {
            return $q.reject('Invalid booking data');
        }

        booking.id = 'booking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        booking.created_at = new Date().toISOString();
        booking.status = booking.status || 'pending';
        
        return DatabaseService.add('bookings', booking)
            .catch(function(error) {
                console.error('Error creating booking:', error);
                return $q.reject(error);
            });
    };
    this.getBookedDatesForCar = function(carId) {
        return DatabaseService.query('bookings', 'car_id', carId);
    };
    this.getOwnerBookings = function(status, notStarted) {
        var userSession = JSON.parse(sessionStorage.getItem('userSession'));
        
        if (!userSession || !userSession.user_id) {
            return $q.reject('User not authenticated');
        }

        return DatabaseService.query('bookings', 'owner_id', userSession.user_id)
            .then(function(bookings) {
                if (!bookings || !Array.isArray(bookings)) {
                    return [];
                }

                // Filter bookings based on parameters
                return bookings.filter(function(booking) {
                    if (status && booking.status !== status) {
                        return false;
                    }

                    if (notStarted) {
                        var startDate = new Date(booking.start_date);
                        var now = new Date();
                        if (startDate <= now) {
                            return false;
                        }
                    }

                    return true;
                }).map(function(booking) {
                    // Add computed properties
                    booking.formattedDates = formatDateRange(booking.start_date, booking.end_date);
                    booking.totalAmount = calculateTotalAmount(booking);
                    return booking;
                });
            })
            .catch(function(error) {
                console.error('Error fetching owner bookings:', error);
                return $q.reject(error);
            });
    };

    this.getBookingsByStatus = function(status, userId, isOwner = false) {
        if (!status || !userId) {
            console.error('Missing parameters:', { status, userId });
            return $q.reject('Status and user ID are required');
        }
    
        const queryField = isOwner ? 'owner_id' : 'user_id';
        console.log('Querying bookings with:', { queryField, userId, status });
    
        return DatabaseService.query('bookings', queryField, userId)
            .then(function(bookings) {
                console.log('Raw bookings from DB:', bookings);
                
                if (!bookings || !Array.isArray(bookings)) {
                    console.warn('No bookings found or invalid data');
                    return [];
                }
    
                const filteredBookings = bookings.filter(function(booking) {
                    return booking.status === status;
                });
                
                console.log('Filtered bookings:', filteredBookings);
                return filteredBookings;
            })
            .catch(function(error) {
                console.error('Error in getBookingsByStatus:', error);
                return $q.reject(error);
            });
    };
    this.getBookingsByUser = function(user_id){
        return DatabaseService.query('bookings', 'user_id', user_id)
            .then(function(bookings){
                return bookings;
            })
            .catch(function(error){
                console.error('Error fetching user bookings:', error);
                return $q.reject(error);
            });
    }
    this.handlePostApproval = function(carId, approvedBooking) {
        // Store reference to service instance
        const self = this;
        
        return DatabaseService.query('bookings', 'car_id', carId)
            .then(function(allBookings) {
                // Filter pending bookings
                const pendingBookings = allBookings.filter(booking => 
                    booking.status === 'pending' && 
                    booking.id !== approvedBooking.id
                );

                console.log('Checking conflicts for bookings:', pendingBookings);

                // Check each pending booking for collision
                const rejectPromises = pendingBookings
                    .filter(function(pending) {
                        const pendingStart = new Date(pending.start_date);
                        const pendingEnd = new Date(pending.end_date);
                        const approvedStart = new Date(approvedBooking.start_date);
                        const approvedEnd = new Date(approvedBooking.end_date);

                        // Check for date overlap
                        return (pendingStart <= approvedEnd && approvedStart <= pendingEnd);
                    })
                    .map(function(conflictingBooking) {
                        console.log('Rejecting conflicting booking:', conflictingBooking);
                        // Use stored reference to service
                        return self.updateBookingStatus(conflictingBooking.id, 'rejected');
                    });

                return $q.all(rejectPromises);
            })
            .catch(function(error) {
                console.error('Error in post-approval handling:', error);
                return $q.reject('Error processing related bookings: ' + error);
            });
    };

    this.updateBookingStatus = function(bookingId, newStatus) {
        if (!bookingId || !newStatus) {
            return $q.reject('Booking ID and new status are required');
        }

        return DatabaseService.get('bookings', bookingId)
            .then(function(booking) {
                if (!booking) {
                    return $q.reject('Booking not found');
                }

                booking.status = newStatus;
                booking.updated_at = new Date().toISOString();
                booking.metadata = {
                    ...booking.metadata,
                    status_updated_at: new Date().toISOString(),
                    previous_status: booking.status
                };

                return DatabaseService.update('bookings', booking)
                    .then(function() {
                        return booking; // Return updated booking for chaining
                    });
            });
    };

    // Add this method to BookingService
    this.getAllBookings = function() {
        return DatabaseService.getAll('bookings')
            .then(function(bookings) {
                if (!bookings || !Array.isArray(bookings)) {
                    console.warn('No bookings found or invalid data');
                    return [];
                }
                
                // Enhance bookings with computed properties
                return bookings.map(function(booking) {
                    booking.formattedDates = formatDateRange(booking.start_date, booking.end_date);
                    booking.totalAmount = calculateTotalAmount(booking);
                    return booking;
                });
            })
            .catch(function(error) {
                console.error('Error fetching all bookings:', error);
                return $q.reject('Failed to get bookings: ' + error);
            });
    };

    // Create a bid
    this.createBid = function(bidData) {
        if (!bidData || !bidData.car_id || !bidData.user_id || !bidData.owner_id) {
            return $q.reject('Missing required bid information');
        }
        
        const newBid = {
            id: 'bid_' + new Date().getTime(),
            car_id: bidData.car_id,
            user_id: bidData.user_id,
            owner_id: bidData.owner_id,
            start_date: bidData.start_date,
            end_date: bidData.end_date,
            days: bidData.days,
            daily_rate: bidData.daily_rate,
            total_amount: bidData.total_amount,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        return DatabaseService.add('bids', newBid)
            .then(function() {
                return newBid;
            });
    };

    // Update bid status
    this.updateBidStatus = function(bidId, status) {
        if (!bidId || !status) {
            return $q.reject('Bid ID and status are required');
        }
        
        return DatabaseService.get('bids', bidId)
            .then(function(bid) {
                if (!bid) {
                    return $q.reject('Bid not found');
                }
                
                bid.status = status;
                bid.updated_at = new Date().toISOString();
                
                // If accepted, create a booking
                if (status === 'accepted') {
                    const booking = {
                        id: 'booking_' + new Date().getTime(),
                        car_id: bid.car_id,
                        user_id: bid.user_id,
                        owner_id: bid.owner_id,
                        start_date: bid.start_date,
                        end_date: bid.end_date,
                        days: bid.days,
                        daily_rate: bid.daily_rate,
                        total_amount: bid.total_amount,
                        status: 'confirmed',
                        bid_id: bid.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    return DatabaseService.add('bookings', booking)
                        .then(function() {
                            return DatabaseService.update('bids', bid);
                        });
                }
                
                return DatabaseService.update('bids', bid);
            });
    };

    // Get booked dates for a car
    this.getBookedDatesByCar = function(carId) {
        if (!carId) {
            return $q.reject('Car ID is required');
        }
        
        return DatabaseService.query('bookings', 'car_id', carId)
            .then(function(bookings) {
                if (!bookings || !bookings.length) {
                    return [];
                }
                
                // Only consider confirmed or active bookings
                const validBookings = bookings.filter(booking => 
                    booking.status === 'confirmed' || booking.status === 'active'
                );
                
                // Generate array of all booked dates
                const blockedDates = [];
                validBookings.forEach(function(booking) {
                    const start = new Date(booking.start_date);
                    const end = new Date(booking.end_date);
                    
                    // Add each date in range to blocked dates
                    let currentDate = new Date(start);
                    while (currentDate <= end) {
                        blockedDates.push(new Date(currentDate));
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                });
                
                return blockedDates;
            });
    };

    // Helper function to format date range
    function formatDateRange(startDate, endDate) {
        var start = new Date(startDate);
        var end = new Date(endDate);
        return start.toLocaleDateString() + ' - ' + end.toLocaleDateString();
    }

    // Helper function to calculate total amount
    function calculateTotalAmount(booking) {
        var start = new Date(booking.start_date);
        var end = new Date(booking.end_date);
        var days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return days * booking.bid_amount;
    }

    // Helper function to format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
}]);

