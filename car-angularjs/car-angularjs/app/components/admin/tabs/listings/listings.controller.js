/**
 * @description Listings Controller
 * Handles car listing management and approval workflow
 */
angular.module('carApp')
.controller('ListingsController', [
    '$scope',
    'CarService',
    'UserService',
    'ToastService',
    '$timeout',
    'StyleLoaderService',
    function($scope, CarService, UserService, ToastService, $timeout, StyleLoaderService) {
        const vm = this;
        
        // Loading state
        vm.loading = {
            listings: false
        };
        
        // Listings data
        vm.pendingListings = [];
        vm.listingSearch = '';
        vm.listingSort = 'date-asc';
        
        /**
         * @description Initialize the listings controller
         * Loads pending listings data
         */
        vm.init = function() {
            // Load component specific CSS
            StyleLoaderService.loadStylesheet('app/components/admin/tabs/listings/listings.css')
                .catch(error => {
                    console.error('Failed to load listings styles:', error);
                });
            
            // Load pending listings
            loadPendingListings();
        };
        
        /**
         * @description Determine the order for listings based on sort selection
         * @param {string} sortType - The sort type to apply
         * @returns {string} Angular orderBy expression
         */
        vm.getListingOrder = function(sortType) {
            switch (sortType) {
                case 'date-desc': return '-created_at';
                case 'date-asc': return 'created_at';
                case 'price-desc': return '-price_per_day';
                case 'price-asc': return 'price_per_day';
                default: return '-created_at';
            }
        };
        
        /**
         * @description Approve a car listing
         * @param {Object} listing - The car listing to approve
         */
        vm.approveListing = function(listing) {
            listing.processing = true;
            CarService.updateCarStatus(listing.car_id, 'available')
                .then(function() {
                    ToastService.success('Listing approved successfully');
                    // Remove from pending list
                    vm.pendingListings = vm.pendingListings.filter(item => item.car_id !== listing.car_id);
                })
                .catch(function(error) {
                    ToastService.error('Failed to approve listing: ' + error);
                })
                .finally(function() {
                    listing.processing = false;
                });
        };
        
        /**
         * @description Reject a car listing
         * @param {Object} listing - The car listing to reject
         */
        vm.rejectListing = function(listing) {
            listing.processing = true;
            CarService.updateCarStatus(listing.car_id, 'rejected')
                .then(function() {
                    ToastService.success('Listing rejected');
                    // Remove from pending list
                    vm.pendingListings = vm.pendingListings.filter(item => item.car_id !== listing.car_id);
                })
                .catch(function(error) {
                    ToastService.error('Failed to reject listing: ' + error);
                })
                .finally(function() {
                    listing.processing = false;
                });
        };
        
    /**
     * @description Load pending car listings
     * Uses stored owner information from listing objects
     */
    function loadPendingListings() {
        vm.loading.listings = true;
        
        CarService.getPendingListings()
            .then(function(listings) {
                vm.pendingListings = listings.map(function(listing) {
                    try {
                        // Parse the stored owner object if it's a string
                        const ownerData = typeof listing.owner === 'string' ? 
                            JSON.parse(listing.owner) : listing.owner;
                        
                        // Extract just the owner name
                        listing.ownerName = ownerData.name || 'Unknown';
                    } catch (error) {
                        console.error('Error parsing owner data for listing:', listing.car_id);
                        listing.ownerName = 'Unknown';
                    }
                    return listing;
                });
                
                // Force digest cycle update
                $timeout();
            })
            .catch(function(error) {
                console.error('Error loading listings:', error);
                ToastService.error('Failed to load pending listings');
            })
            .finally(function() {
                vm.loading.listings = false;
            });
    }
    }
]);