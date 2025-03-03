/**
 * @description Add Car Controller
 * This controller handles the vehicle creation process in the car rental application,
 * including form validation, image handling, and updating user roles.
 */
angular.module('carApp')
.controller('AddCarController', [
    '$scope', 
    'CarService', 
    'ToastService', 
    '$state', 
    'UserService',
    '$timeout',
    '$q',
    'StyleLoaderService',
    'UtilService',
function($scope, CarService, ToastService, $state, UserService, $timeout, $q, StyleLoaderService, UtilService) {
    const vm = this;
    // Get current user session from sessionStorage
    const userSession = JSON.parse(sessionStorage.getItem('userSession'));
    
    // Lazily load component-specific CSS
    StyleLoaderService.loadStylesheet('app/components/add-car/add-car.css')
        .catch(error => {
            console.error('Failed to load component styles:', error);
        });
    
    /**
     * @description Car data model with default values
     * This object holds all form fields and is bound to the UI
     */
    vm.carData = {
        make: '',                            // Car manufacturer
        model: '',                           // Car model name
        year: new Date().getFullYear(),      // Default to current year
        color: '#000000',                    // Default color (black)
        location: '',                        // Car location/city
        seats: 5,                            // Default seat count
        transmission: '',                    // Transmission type (auto/manual)
        fuel_type: '',                       // Fuel type (petrol/diesel/electric)
        rate_per_mile: 0,                    // Cost per additional mile
        fixed_miles: 0,                      // Free miles included with rental
        price_per_day: 0,                    // Base daily rental price
        status: 'pending',                   // Default status for new cars
        images: [],                          // Array to store car images
        owner_id: userSession?.user_id,      // Owner ID from current session
        owner:{}                             // Owner details
    };

    UserService.getUserById(vm.carData.owner_id)
    .then(owner => {
        vm.carData.owner = JSON.stringify(owner) || {};
        console.log('Owner details:', vm.carData.owner);
    })
    .catch(error => {
        console.error('Failed to fetch owner details:', error);
        vm.carData.owner = {};
    });
    
    // Available options for select dropdowns
    vm.carMakes = ['Honda', 'Ford', 'Chevrolet', 'Volkswagen', 'Audi', 'Toyota', 'Nissan'];
    vm.cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'];
    vm.transmissions = ['Automatic', 'Manual','Semi-Automatic'];
    
    // Flag to prevent multiple form submissions
    vm.isSubmitting = false;
    
    /**
     * @description Form submission handler
     * Validates form data and submits the new car to the database
     */
    vm.submitForm = () => {
        // Ensure user is logged in
        if (!userSession) {
            ToastService.error('Please login to add a car');
            $state.go('login');
            return;
        }

        const carForm = $scope.carForm;
        
        // Check form validity
        if (carForm && carForm.$invalid) {
            ToastService.error('Please fill all required fields');
            return;
        }
        
        // Set submitting flag to prevent duplicate submissions
        vm.isSubmitting = true;

        // Create new car object with unique UUID and timestamp
        const newCar = {
            ...vm.carData,
            car_id: 'car_' + UtilService.generateUUID(),  // Use UtilService for UUID
            created_at: new Date().toISOString()   // Record creation timestamp
        };

        // Submit car to service
        CarService.addCar(newCar)
            .then(() => {
                // If user is not already an owner or admin, update their role
                if (!['owner', 'admin'].includes(userSession.role)) {
                    return UserService.updateUserRole(userSession.user_id, 'owner')
                        .then(() => {
                            // Update session storage with new role
                            userSession.role = 'owner';
                            sessionStorage.setItem('userSession', JSON.stringify(userSession));
                        });
                }
                return $q.resolve(); // No role update needed
            })
            .then(() => {
                // Show success message and navigate to my-cars page
                ToastService.success('Car added successfully');
                $state.go('home');
            })
            .catch(error => {
                // Handle and display errors
                ToastService.error('Failed to add car: ' + error);
            })
            .finally(() => {
                // Reset submission flag regardless of outcome
                vm.isSubmitting = false;
            });
    };

    /**
     * @description Image upload handler
     * Processes selected image files, performs validation, and adds them to car data
     * @param {Event} event - The file input change event
     */
    vm.handleImageUpload = event => {
        const files = event.target.files;
        const maxImages = 5;                     // Maximum number of images allowed
        const maxSize = 5 * 1024 * 1024;        // 5MB maximum file size
        
        // Validate total image count
        if (vm.carData.images.length + files.length > maxImages) {
            ToastService.error(`Maximum ${maxImages} images allowed`);
            event.target.value = '';  // Clear the file input
            return;
        }
        
        // Process each file individually
        Array.from(files).forEach(file => {
            // Validate file is an image
            if (!file.type.match('image.*')) {
                ToastService.error(`${file.name} is not a valid image`);
                return;
            }
            
            // Validate file size
            if (file.size > maxSize) {
                ToastService.error(`${file.name} exceeds 5MB size limit`);
                return;
            }
            
            // Read file as data URL
            const reader = new FileReader();
            reader.onloadend = () => {
                // Use $timeout to ensure digest cycle is triggered
                $timeout(() => {
                    // Add image to car data with unique UUID
                    vm.carData.images.push({
                        id: 'img_' + UtilService.generateUUID(),  // Use UtilService for UUID
                        data: reader.result,          // Base64 image data
                        name: file.name               // Original filename
                    });
                });
            };
            reader.readAsDataURL(file);  // Start reading file contents
        });
        
        // Reset file input to allow selecting same files again
        event.target.value = '';
    };

    /**
     * @description Image removal handler
     * Removes an image from the car data by its index
     * @param {number} index - The index of the image to remove
     */
    vm.removeImage = index => {
        vm.carData.images.splice(index, 1);
    };

    /**
     * @description Navigate back to previous page
     */
    vm.goBack = () => {
        $state.go('home');
    };
}]);