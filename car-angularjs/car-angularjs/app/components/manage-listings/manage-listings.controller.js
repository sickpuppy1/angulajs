angular.module('carApp')
.controller('ManageListingsController', [
    '$scope', 
    'BookingService', 
    'ToastService', 
    'DatabaseService', 
    '$q',
function($scope, BookingService, ToastService, DatabaseService, $q) {
    var vm = this;
    var userSession = JSON.parse(sessionStorage.getItem('userSession'));

    // Initialize data
    vm.activeTab = 'bookings';
    vm.bookings = [];
    vm.approved = [];
    vm.rejected = [];
    vm.startTrips = [];
    vm.endTrips = [];
    vm.isLoading = true;

    // Check authentication first
    if (!userSession || !userSession.user_id) {
        ToastService.error('Please login to access this page');
        $state.go('login');
        return;
    }

    // Set active tab
    vm.setActiveTab = function(tab) {
        vm.activeTab = tab;
        loadTabData(tab);
    };

    function loadTabData(tab) {
        vm.isLoading = true;
        
        switch(tab) {
            case 'bookings':
                loadPendingBookings();
                break;
            case 'approved':
                loadApprovedBookings();
                break;
            case 'rejected':
                loadRejectedBookings();
                break;
            case 'start-trips':
                loadStartTrips();
                break;
            case 'end-trips':
                loadEndTrips();
                break;
        }
    }

    function loadPendingBookings() {
        vm.isLoading = true;
        console.log('Loading pending bookings for owner:', userSession.user_id);
        
        BookingService.getBookingsByStatus('pending', userSession.user_id, true)
            .then(function(bookings) {
                vm.bookings = bookings || [];
                console.log('Loaded pending bookings:', vm.bookings);
            })
            .catch(handleError)
            .finally(finishLoading);
    }

    function loadApprovedBookings() {
        vm.isLoading = true;
        BookingService.getBookingsByStatus('approved', userSession.user_id, true)
            .then(function(bookings) {
                vm.approved = bookings || [];
                console.log('Loaded approved bookings:', vm.approved);
            })
            .catch(handleError)
            .finally(finishLoading);
    }

    function loadRejectedBookings() {
        vm.isLoading = true;
        BookingService.getBookingsByStatus('rejected', userSession.user_id, true)
            .then(function(bookings) {
                vm.rejected = bookings || [];
                console.log('Loaded rejected bookings:', vm.rejected);
            })
            .catch(handleError)
            .finally(finishLoading);
    }

    function loadStartTrips() {
        vm.isLoading = true;
        BookingService.getBookingsByStatus('approved', userSession.user_id, true)
            .then(function(bookings) {
                vm.startTrips = (bookings || []).filter(booking => {
                    const today = new Date();
                    const startDate = new Date(booking.start_date);
                    return today.toDateString() === startDate.toDateString();
                });
                console.log('Loaded start trips:', vm.startTrips);
            })
            .catch(handleError)
            .finally(finishLoading);
    }

    function loadEndTrips() {
        vm.isLoading = true;
        BookingService.getBookingsByStatus('active', userSession.user_id, true)
            .then(function(bookings) {
                vm.endTrips = bookings || [];
                console.log('Loaded end trips:', vm.endTrips);
            })
            .catch(handleError)
            .finally(finishLoading);
    }

    // Helper functions
    function handleError(error) {
        console.error('Error loading bookings:', error);
        ToastService.error('Failed to load bookings: ' + error);
    }

    function finishLoading() {
        vm.isLoading = false;
    }

    // Booking actions
    vm.approveBooking = function(bookingId) {
        vm.isLoading = true;
        
        BookingService.updateBookingStatus(bookingId, 'approved')
            .then(function(updatedBooking) {
                ToastService.success('Booking approved successfully');
                // Handle post-approval conflicts
                return BookingService.handlePostApproval(updatedBooking.car_id, updatedBooking);
            })
            .then(function() {
                // Refresh all relevant lists
                return $q.all([
                    loadPendingBookings(),
                    loadApprovedBookings(),
                    loadRejectedBookings()
                ]);
            })
            .catch(handleError)
            .finally(function() {
                vm.isLoading = false;
            });
    };

    vm.rejectBooking = function(bookingId) {
        BookingService.updateBookingStatus(bookingId, 'rejected')
            .then(function() {
                ToastService.success('Booking rejected successfully');
                loadTabData(vm.activeTab);
            })
            .catch(handleError);
    };

    vm.startTrip = function(bookingId) {
        BookingService.updateBookingStatus(bookingId, 'active')
            .then(function() {
                ToastService.success('Trip started successfully');
                loadTabData(vm.activeTab);
            })
            .catch(handleError);
    };

    vm.endTrip = function(bookingId) {
        BookingService.updateBookingStatus(bookingId, 'completed')
            .then(function() {
                ToastService.success('Trip completed successfully');
                loadTabData(vm.activeTab);
            })
            .catch(handleError);
    };

    // Initialize when database is ready
    DatabaseService.ready().then(function() {
        loadTabData(vm.activeTab);
    }).catch(function(error) {
        handleError('Database initialization failed: ' + error);
    });
}]);