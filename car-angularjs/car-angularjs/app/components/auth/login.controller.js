/**
 * @description Login Controller
 * Handles user authentication and login workflow
 */
angular.module('carApp')
.controller('LoginController', [
    '$state', 
    'AuthService', 
    'ToastService',
    'StyleLoaderService',
    function($state, AuthService, ToastService, StyleLoaderService) {
        const vm = this;
        
        /**
         * @description Initialize controller
         * Loads component-specific CSS
         */
        vm.init = function() {
            // Load login component CSS
            StyleLoaderService.loadStylesheet('app/components/auth/login.css')
                .then(() => {
                    console.log('Login styles loaded');
                })
                .catch(error => {
                    console.error('Failed to load login styles:', error);
                });
        };
        /**
         * @description User credentials model
         * Bound to login form inputs
         * @type {Object}
         */
        vm.user = {
            email: '',
            password: ''
        };
        
        /**
         * @description Loading state flag
         * Prevents multiple simultaneous login attempts
         * @type {boolean}
         */
        vm.isLoading = false;
        
        /**
         * @description Error message storage
         * Holds any login error messages
         * @type {string|null}
         */
        vm.error = null;
        
        /**
         * @description Handle user login
         * Authenticates user credentials and redirects based on role
         * @returns {void}
         */
        vm.login = function() {
            if (vm.isLoading) return;
            
            vm.isLoading = true;
            AuthService.login(vm.user)
                .then(function(response) {
                    ToastService.success('Login successful!');
                    
                    // Redirect based on user role
                    if (response && response.role === 'admin') {
                        $state.go('admin');
                    } else {
                        $state.go('home');
                    }
                })
                .catch(function(error) {
                    ToastService.error('Login failed: ' + error);
                })
                .finally(function() {
                    vm.isLoading = false;
                });
        };
        /**
         * @description Navigate to registration
         * Redirects user to the registration page
         * @returns {void}
         */
        vm.goToRegister = function() {
            $state.go('register');
        };
    }
]);