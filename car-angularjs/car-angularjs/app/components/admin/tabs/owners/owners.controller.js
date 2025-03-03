/**
 * @description Owners Controller
 * Handles the owner management tab of the admin dashboard
 */
angular.module('carApp')
.controller('OwnersController', [
    'StyleLoaderService',
    'UserService',
    'CarService',
    'ToastService', 
    '$timeout',
    function(StyleLoaderService, UserService, CarService, ToastService, $timeout) {
        const vm = this;
        
        // Loading state
        vm.loading = false;
        
        // Owners data
        vm.owners = [];
        vm.activeOwners = [];
        vm.blockedOwners = [];
        vm.ownerSearch = '';
        vm.ownerStatus = 'all';
        
        /**
         * @description Initialize the controller
         */
        vm.init = function() {
            // Load component-specific CSS
            StyleLoaderService.loadStylesheet('app/components/admin/tabs/owners/owners.css')
                .catch(error => {
                    console.error('Failed to load owners styles:', error);
                });
            
            // Load data
            loadOwners();
        };
        
        function loadOwners() {
            vm.loading = true;
            
            async.series({
                // First fetch all owners
                fetchOwners: function(callback) {
                    UserService.getUsersByRole('owner')
                        .then(function(owners) {
                            vm.owners = owners;
                            vm.activeOwners = owners.filter(owner => !owner.blocked);
                            vm.blockedOwners = owners.filter(owner => owner.blocked);
                            callback(null, owners);
                        })
                        .catch(function(error) {
                            callback(error);
                        });
                },
                
                // Then get car counts for each owner
                fetchCarCounts: function(callback) {
                    async.each(vm.owners, function(owner, ownerCallback) {
                        CarService.getCarsByOwner(owner.user_id)
                            .then(function(cars) {
                                console.log('Cars for owner', owner.user_id, cars.status); 
                                owner.carCount = cars.filter(car => 
                                    car.status === "available" || 
                                    car.status === "unlisted" || 
                                    car.status === "unlisted-pending"||
                                    car.status === "pending"
                                ).length;
                                ownerCallback();
                            })
                            .catch(function() {
                                owner.carCount = 0;
                                ownerCallback();
                            });
                    }, function(error) {
                        callback(error, vm.owners);
                    });
                }
            }, function(error) {
                if (error) {
                    console.error('Error loading owners:', error);
                    ToastService.error('Failed to load owners');
                }
                
                vm.loading = false;
                $timeout();
            });
        }
        
        /**
         * @description Block an owner and unlist their cars
         * @param {Object} owner - The owner to block
         */
        vm.blockOwner = function(owner) {
            owner.processing = true;
            
            async.waterfall([
                // Step 1: Update user status to blocked
                function updateUserStatus(callback) {
                    UserService.updateUserStatus(owner.user_id, "blocked")
                        .then(() => callback(null))
                        .catch(err => callback(err));
                },
                
                // Step 2: Get all cars by this owner
                function getOwnerCars(callback) {
                    CarService.getCarsByOwner(owner.user_id)
                        .then(cars => callback(null, cars))
                        .catch(err => callback(err));
                },
                
                // Step 3: Update car statuses
                function updateCarStatuses(cars, callback) {
                    owner.carCount = cars.length;
                    
                    async.each(cars, function(car, carCallback) {
                        if (!car.metadata) {
                            car.metadata = {};
                        }
                        
                        if (car.status === 'pending') {
                            car.metadata.previousStatus = car.status;
                            CarService.updateCarStatus(car.car_id, 'unlisted-pending', car.metadata)
                                .then(() => carCallback(null))
                                .catch(err => carCallback(err));
                        } 
                        else if (car.status === 'available') {
                            car.metadata.previousStatus = 'available';
                            CarService.updateCarStatus(car.car_id, 'unlisted', car.metadata)
                                .then(() => carCallback(null))
                                .catch(err => carCallback(err));
                        }
                        else {
                            carCallback(null);
                        }
                    }, callback);
                }
                
            ], function(error) {
                if (error) {
                    console.error('Error blocking owner:', error);
                    ToastService.error('Failed to block owner');
                } else {
                    ToastService.success('Owner blocked and all listings unlisted');
                    
                    // Update local owner state
                    owner.blocked = true;
                    
                    // Move owner from active to blocked array without refetching
                    vm.activeOwners = vm.activeOwners.filter(pookie => pookie.user_id !== owner.user_id);
                    vm.blockedOwners.push(owner);
                }
                
                owner.processing = false;
                $timeout(); // Trigger digest cycle
            });
        };
        
        /**
         * @description Unblock an owner and restore their car listings
         * @param {Object} owner - The owner to unblock
         */
        vm.unblockOwner = function(owner) {
            owner.processing = true;
            
            UserService.updateUserStatus(owner.user_id, false)
                .then(function() {
                    // Get all cars by this owner
                    return CarService.getCarsByOwner(owner.user_id);
                })
                .then(function(cars) {
                    // Store updated car count
                    owner.carCount = cars.length;
                    
                    // Restore cars to their original status
                    const carUpdatePromises = cars.map(function(car) {
                        // Handle unlisted-pending cars
                        if (car.status === 'unlisted-pending') {
                            const originalStatus = car.metadata && car.metadata.previousStatus ? 
                                car.metadata.previousStatus : 'pending';
                            
                            return CarService.updateCarStatus(car.car_id, originalStatus, car.metadata);
                        }
                        // Handle regular unlisted cars
                        else if (car.status === 'unlisted') {
                            const originalStatus = car.metadata && car.metadata.previousStatus ? 
                                car.metadata.previousStatus : 'available';
                            
                            return CarService.updateCarStatus(car.car_id, originalStatus, car.metadata);
                        }
                        // Don't change other cars
                        return Promise.resolve();
                    });
                    
                    return Promise.all(carUpdatePromises);
                })
                .then(function() {
                    ToastService.success('Owner unblocked and listings restored to original status');
                    
                    // Update local owner state
                    owner.blocked = false;
                    
                    // Move owner from blocked to active array without refetching
                    vm.blockedOwners = vm.blockedOwners.filter(o => o.user_id !== owner.user_id);
                    vm.activeOwners.push(owner);
                })
                .catch(function(error) {
                    console.error('Error unblocking owner:', error);
                    ToastService.error('Failed to unblock owner');
                })
                .finally(function() {
                    owner.processing = false;
                    $timeout(); // Trigger digest cycle
                });
        };
        
        /**
         * @description View owner details and cars
         * @param {Object} owner - The owner to view
         */
        vm.viewOwnerDetails = function(owner) {
            // This would typically open a modal with owner details
            // For now, let's just show their cars
            vm.loading = true;
            
            CarService.getCarsByOwner(owner.user_id)
                .then(function(cars) {
                    owner.cars = cars;
                    owner.showDetails = true;
                })
                .catch(function(error) {
                    console.error('Error fetching owner cars:', error);
                    ToastService.error('Failed to fetch owner cars');
                })
                .finally(function() {
                    vm.loading = false;
                    $timeout();
                });
        };
    }
]);