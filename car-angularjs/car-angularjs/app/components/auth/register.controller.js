angular.module('carApp')
.controller('RegisterController', [
    '$state', 
    'UserService', 
    'AuthService', 
    'ToastService',
    'StyleLoaderService',
    function($state, UserService, AuthService, ToastService, StyleLoaderService) {
        var vm = this;
        
        vm.init = function() {
            StyleLoaderService.loadStylesheet('app/components/auth/register.css')
                .catch(error => {
                    console.error('Failed to load register styles:', error);
                });
        };
        
        vm.user = {
            name: '',
            email: '',
            password: '',
            mobile: ''
        };

        vm.isLoading = false;
        vm.error = null;
        vm.errors = {
            name: '',
            email: '',
            password: '',
            mobile: ''
        };
        
        vm.validateName = function() {
            if (!vm.user.name) {
                vm.errors.name = 'Name is required';
                return false;
            } else if (!/^[a-zA-Z\s]{2,50}$/.test(vm.user.name)) {
                vm.errors.name = 'Please enter a valid name (letters only)';
                return false;
            }
            vm.errors.name = '';
            return true;
        };
        
        vm.validateEmail = function() {
            if (!vm.user.email) {
                vm.errors.email = 'Email is required';
                return false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vm.user.email)) {
                vm.errors.email = 'Please enter a valid email address';
                return false;
            }
            vm.errors.email = '';
            return true;
        };
        
        vm.validatePassword = function() {
            if (!vm.user.password) {
                vm.errors.password = 'Password is required';
                return false;
            }
            
            const hasMinLength = vm.user.password.length >= 8;
            const hasUpperCase = /[A-Z]/.test(vm.user.password);
            const hasLowerCase = /[a-z]/.test(vm.user.password);
            const hasNumbers = /\d/.test(vm.user.password);
            
            if (!(hasMinLength && hasUpperCase && hasLowerCase && hasNumbers)) {
                vm.errors.password = 'Password must be at least 8 characters with uppercase, lowercase and numbers';
                return false;
            }
            
            vm.errors.password = '';
            return true;
        };

        vm.validateMobile = function() {
            if (!vm.user.mobile) {
                vm.errors.mobile = 'Mobile number is required';
                return false;
            } else if (!/^[0-9]{10}$/.test(vm.user.mobile)) {
                vm.errors.mobile = 'Please enter a valid 10-digit mobile number';
                return false;
            }
            vm.errors.mobile = '';
            return true;
        };
        
        vm.validateForm = function() {
            return vm.validateName() && 
                   vm.validateEmail() && 
                   vm.validatePassword() && 
                   vm.validateMobile();
        };
        
        vm.register = function() {
            if (vm.isLoading) return;
            
            // Manual form validation
            if (!vm.validateForm()) {
                return;
            }

            vm.isLoading = true;
            vm.error = null;

            UserService.registerUser(vm.user)
                .then(function(registeredUser) {
                    ToastService.success('Registration successful!');
                    return AuthService.login({
                        email: vm.user.email,
                        password: vm.user.password
                    });
                })
                .then(function(user) {
                    const sessionData = {
                        user_id: user.user_id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    };
                    sessionStorage.setItem('userSession', JSON.stringify(sessionData));
                    
                    ToastService.success('Welcome, ' + user.name);
                    $state.go('home');
                })
                .catch(function(error) {
                    vm.error = error;
                    ToastService.error(error);
                })
                .finally(function() {
                    vm.isLoading = false;
                });
        };

        vm.goToLogin = function() {
            $state.go('login');
        };
    }
]);