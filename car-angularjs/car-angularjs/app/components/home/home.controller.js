angular.module('carApp')
.controller('HomeController', [
    '$scope', 
    '$state',
    'AuthService', 
    'CarService', 
    'ToastService', 
function($scope,$state, AuthService, CarService, ToastService) {
    var vm = this;
    
    // Authentication state and basic setup
    vm.isAuthenticated = AuthService.isAuthenticated();
    vm.currentUser = AuthService.getCurrentUser();
    vm.isLoading = true;
    vm.placeholderImage = 'data:image/svg+xml;base64,...';// Your placeholder image
    vm.isOwner = function() {
        var userSession = JSON.parse(sessionStorage.getItem('userSession'));
        return userSession && userSession.role === 'owner';
    }; 

    // Car display properties
    vm.cars = [];
    vm.failedImages = new Set();
    vm.currentPage = 1;
    vm.totalPages = 1;
    vm.itemsPerPage = 8;
    vm.sortOrder = 'price-desc';
    vm.filters = {
        location: '',
        make: '',
        year: '',
        minPrice: '',
        maxPrice: '',
        status: 'available'
    };
    

    // Initialize
    // Initialize
    function init() {
        // Load initial filters
        loadFilters();
        
        // Check if user is authenticated and load cars with default filters
        if (vm.isAuthenticated) {
            // Apply default filters for logged-in users
            vm.sortOrder = 'price-asc';
            loadCars();
        }
}

    function loadCars() {
        vm.isLoading = true;
        CarService.getAllCars(vm.filters, vm.sortOrder, vm.currentPage)
            .then(function(result) {
                vm.cars = result.cars.map(car => ({
                    ...car,
                    displayImage: car.images && car.images.length > 0 ? 
                        car.images[0].data : vm.placeholderImage
                }));
                vm.totalPages = result.totalPages;
                vm.currentPage = result.currentPage;
                vm.totalCars = result.totalCars;
            })
            .catch(function(error) {
                ToastService.error('Error loading cars: ' + error);
            })
            .finally(function() {
                vm.isLoading = false;
            });
    }

    function loadFilters() {
        CarService.getAvailableMakes().then(makes => vm.makes = makes);
        CarService.getAvailableYears().then(years => vm.years = years);
    }

    // Actions
    vm.logout = function() {
        AuthService.logout();
    };

    vm.applyFilters = function() {
        vm.currentPage = 1;
        loadCars();
    };

    vm.sortCars = function() {
        loadCars();
    };

    vm.goToPage = function(page) {
        if (page >= 1 && page <= vm.totalPages) {
            vm.currentPage = page;
            loadCars();
        }
    };

    vm.openBidModal = function(car) {
        if (!vm.isAuthenticated) {
            ToastService.error('Please login to place a bid');
            return;
        }
        vm.selectedCar = car;
        vm.bid = {
            startDate: null,
            endDate: null,
            amount: car.price_per_day
        };
        vm.showBidModal = true;
    };

    vm.closeBidModal = function() {
        vm.showBidModal = false;
        vm.selectedCar = null;
        vm.bid = {
            startDate: null,
            endDate: null,
            amount: null
        };
    };

    vm.calculateTotalPrice = function() {
        if (!vm.bid.startDate || !vm.bid.endDate || !vm.bid.amount) return 0;
        
        const start = new Date(vm.bid.startDate);
        const end = new Date(vm.bid.endDate);
        const days = Math.ceil(((end - start)+1) / (1000 * 60 * 60 * 24));
        return days * vm.bid.amount;
    };

    vm.placeBid = function() {
        if (!vm.bid.startDate || !vm.bid.endDate || !vm.bid.amount) {
            ToastService.error('Please fill all bid details');
            return;
        }

        if (vm.bid.amount < vm.selectedCar.price_per_day) {
            ToastService.error(`Minimum bid amount is $${vm.selectedCar.price_per_day}`);
            return;
        }

        const bidData = {
            car_id: vm.selectedCar.car_id,
            user_id: vm.currentUser.user_id,
            start_date: vm.bid.startDate,
            end_date: vm.bid.endDate,
            bid_amount: vm.bid.amount,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        CarService.placeBid(bidData)
            .then(() => {
                ToastService.success('Bid placed successfully');
                vm.closeBidModal();
                loadCars();
            })
            .catch(error => {
                ToastService.error('Failed to place bid: ' + error);
            });
    };

    // Image handling
    vm.handleImageError = function(car) {
        vm.failedImages.add(car.displayImage);
        car.displayImage = vm.placeholderImage;
    };

    // Navigation
    vm.goToCarDetails = function(carId) {
        if (!carId) return;
        
        $state.go('carDetails', { 
            id: carId 
        }, {
            reload: true
        });
    };
    init();
}]);