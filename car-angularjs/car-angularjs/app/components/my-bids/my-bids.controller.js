angular.module('carApp')
.controller('MyBidsController', [
    '$scope', 
    'BookingService', 
    'ToastService', 
    '$timeout',
function($scope, BookingService, ToastService, $timeout) {
    var vm = this;

    // Initialize data
    vm.bids = [];
    vm.isLoading = true;
    vm.statusFilter = 'all';
    vm.itemsPerPage = 8;
    vm.currentPage = 1;
    vm.totalBids = 0;

    // Initialize controller
    function init() {
        loadBids();
    }

    function loadBids() {
        vm.isLoading = true;
        BookingService.getBookingsByUser()
            .then(function(bids) {
                vm.allBids = bids;
                filterBids();
            })
            .catch(handleError)
            .finally(function() {
                vm.isLoading = false;
            });
    }

    vm.filterByStatus = function(status) {
        vm.statusFilter = status;
        vm.currentPage = 1;
        filterBids();
    };

    vm.changePage = function(page) {
        vm.currentPage = page;
        filterBids();
    };

    function filterBids() {
        const filtered = vm.statusFilter === 'all' 
            ? vm.allBids 
            : vm.allBids.filter(bid => bid.status.toLowerCase() === vm.statusFilter);
        
        vm.totalBids = filtered.length;
        vm.totalPages = Math.ceil(vm.totalBids / vm.itemsPerPage);
        
        const startIndex = (vm.currentPage - 1) * vm.itemsPerPage;
        vm.bids = filtered.slice(startIndex, startIndex + vm.itemsPerPage);
    }

    vm.showInvoice = function(bookingId) {
        BookingService.getBooking(bookingId)
            .then(function(booking) {
                if (!booking) {
                    throw new Error('Booking not found');
                }
                const tripDetails = calculateTripDetails(booking);
                showInvoiceModal(booking, tripDetails);
            })
            .catch(function(error) {
                ToastService.error('Failed to load invoice: ' + error.message);
            });
    };

    function calculateTripDetails(booking) {
        const startDate = new Date(booking.start_date);
        const endDate = new Date(booking.end_date);
        const days = Math.ceil((endDate - startDate)/(1000*60*60*24));

        return {
            startDate: startDate.toLocaleString(),
            endDate: endDate.toLocaleString(),
            days: days,
            // ...other calculations
        };
    }

    function handleError(error) {
        console.error('Error:', error);
        ToastService.error('Failed to load bids');
    }

    // Initialize the controller
    init();
}]);